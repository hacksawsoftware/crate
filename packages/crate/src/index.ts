import { pathToFileURL } from "node:url";
import { stdin, stdout, stderr } from "node:process";
import { parse } from "@bomb.sh/args";
import type {
  ArgTypes,
  CliConfig,
  CommandDefinition,
  CommandRoute,
  Context,
  JSONSchemaGenerator,
  Hooks,
} from "./types.js";
import { scanCommands } from "./scanner.js";
import { matchRoute, findRootCommand, type RouteMatch } from "./router.js";
import {
  validateWithSchema,
  extractSchemaFlags,
  getSchemaVendor,
  ValidationError,
} from "./schema.js";
import { runBeforeMatch, runBeforeLoad, runBeforeRun, runAfterRun, runOnError } from "./hooks.js";

// Re-exports
export { scanCommands } from "./scanner.js";
export { matchRoute, findRootCommand } from "./router.js";
export {
  validateWithSchema,
  extractSchemaFlags,
  getSchemaVendor,
  ValidationError,
} from "./schema.js";
export { defineCommand } from "./define.js";
export { runBeforeMatch, runBeforeLoad, runBeforeRun, runAfterRun, runOnError } from "./hooks.js";
export type {
  CliConfig,
  CommandDefinition,
  Context,
  CommandRoute,
  ArgTypes,
  JSONSchemaGenerator,
  Hooks,
};

/**
 * Load a command module from file path
 * Commands must use defineCommand() - direct function exports are not supported
 */
async function loadCommand(filePath: string): Promise<CommandDefinition> {
  const fileUrl = pathToFileURL(filePath).href;
  const module = await import(fileUrl);

  // Validate that the default export is a proper CommandDefinition from defineCommand()
  if (!module.default || typeof module.default !== "object") {
    throw new Error(
      `Command at ${filePath} must export a default command definition created with defineCommand()`,
    );
  }

  const command = module.default as Partial<CommandDefinition>;

  // Ensure the required 'default' handler property exists
  if (typeof command.default !== "function") {
    throw new Error(
      `Command at ${filePath} must have a handler function. Use defineCommand({ run: ... }) to create your command.`,
    );
  }

  // Return the command definition as-is (defineCommand() already structures it correctly)
  return module.default as CommandDefinition;
}

/**
 * Create a context object for command execution
 */
function createContext(
  positionalArgs: string[],
  flags: Record<string, unknown>,
  rawArgv: string[],
): Context {
  return {
    stdin,
    stdout,
    stderr,
    args: positionalArgs,
    flags,
    rawArgv,
    log: (...msgs: unknown[]) => console.log(...msgs),
    error: (...msgs: unknown[]) => console.error(...msgs),
  };
}

/**
 * Parse and validate command arguments
 */
async function parseCommand(
  command: CommandDefinition,
  remainingArgs: string[],
  commandName: string,
): Promise<{ args: unknown[]; flags: Record<string, unknown> }> {
  // Extract flag types from schema (auto-detect via JSON Schema or use explicit config)
  const extraction = extractSchemaFlags(command.flags, {
    boolean: command.argTypes?.boolean,
    string: command.argTypes?.string,
    array: command.argTypes?.array,
    defaults: command.defaults,
  });

  if (!extraction.success) {
    const vendor = command.flags ? getSchemaVendor(command.flags) : null;
    console.warn(
      `Warning: Could not auto-detect argument types from ${vendor ?? "unknown"} schema. ` +
        `CLI parsing may not work correctly. Consider providing explicit 'argTypes' in your command definition.`,
    );
  }

  const { boolean, string, array, defaults } = extraction.config;

  // Parse with @bomb.sh/args
  const parsed = parse(remainingArgs, {
    boolean,
    string,
    array,
    default: defaults,
  });

  // Separate flags from positional
  const flags: Record<string, unknown> = {};
  const positional: string[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === "_") {
      // Positional arguments
      for (const arg of value as (string | number | boolean)[]) {
        positional.push(String(arg));
      }
    } else {
      flags[key] = value;
    }
  }

  // Validate flags if schema provided
  if (command.flags) {
    await validateWithSchema(command.flags, flags, "flags", commandName);
  }

  // Validate args if schema provided
  if (command.args) {
    await validateWithSchema(command.args, positional, "args", commandName);
  }

  return { args: positional, flags };
}

/**
 * Execute a command with the given match
 */
async function executeCommand(
  command: CommandDefinition,
  match: RouteMatch,
  rawArgv: string[],
  config: CliConfig,
): Promise<void> {
  // Build command name for error messages
  const commandName = match.route.segments
    .filter((s) => s !== "index")
    .map((s) => (s.startsWith("[") && s.endsWith("]") ? `<${s.slice(1, -1)}>` : s))
    .join(" ");
  const fullCommandName = `${config.name} ${commandName}`.trim();

  const { args, flags } = await parseCommand(command, match.remainingArgs, fullCommandName);

  // Add path params to flags for easy access
  const mergedFlags = { ...flags, ...match.params };

  let ctx = createContext(args as string[], mergedFlags, rawArgv);

  // Run beforeRun hooks - CLI first (outer), then command (inner)
  ctx = await runBeforeRun(config.hooks, command.hooks, ctx);

  // Execute command
  await command.default(ctx);

  // Run afterRun hooks - command first (bubble up), then CLI
  await runAfterRun(config.hooks, command.hooks, ctx);
}

/**
 * Print general CLI help
 */
function printHelp(config: CliConfig, routes: CommandRoute[]): void {
  console.log(`${config.name}${config.version ? ` v${config.version}` : ""}`);
  if (config.description) {
    console.log(config.description);
  }
  console.log();

  console.log("Commands:");
  for (const route of routes) {
    if (route.segments[0] === "index") continue;
    const commandName = route.segments
      .map((s) => (s.startsWith("[") && s.endsWith("]") ? `<${s.slice(1, -1)}>` : s))
      .join(" ");
    console.log(`  ${commandName}`);
  }

  console.log();
  console.log("Run `command --help` for more info on a command.");
}

/**
 * Print help for a specific command
 */
function printCommandHelp(
  config: CliConfig,
  route: CommandRoute,
  command: CommandDefinition,
): void {
  const commandName = route.segments
    .filter((s) => s !== "index")
    .map((s) => (s.startsWith("[") && s.endsWith("]") ? `<${s.slice(1, -1)}>` : s))
    .join(" ");

  console.log(`${config.name} ${commandName}`);

  if (command.meta?.description) {
    console.log();
    console.log(command.meta.description);
  }

  if (command.meta?.examples && command.meta.examples.length > 0) {
    console.log();
    console.log("Examples:");
    for (const example of command.meta.examples) {
      console.log(`  ${example}`);
    }
  }

  console.log();
  console.log("Flags:");
  console.log("  -h, --help    Show help");
}

/**
 * Run the CLI
 */
export async function run(config: CliConfig): Promise<void> {
  let argv = process.argv.slice(2);
  let match: RouteMatch | null = null;
  let command: CommandDefinition | null = null;
  let partialCtx: Partial<Context> = {};

  try {
    const commandsDir = config.commandsDir ?? "commands";

    // Scan for commands
    const routes = await scanCommands(commandsDir);

    if (routes.length === 0) {
      console.error(`No commands found in ${commandsDir}`);
      process.exit(1);
    }

    // Run beforeMatch hooks - can modify argv
    argv = await runBeforeMatch(config.hooks, undefined, argv);

    // Try to match a route
    match = matchRoute(routes, argv);

    if (!match) {
      // Check for help flags
      if (argv.includes("--help") || argv.includes("-h")) {
        printHelp(config, routes);
        return;
      }

      // Try root command
      const rootRoute = findRootCommand(routes);
      if (rootRoute) {
        match = {
          route: rootRoute,
          params: {},
          remainingArgs: argv,
        };
      } else {
        console.error(`Unknown command: ${argv.join(" ")}`);
        printHelp(config, routes);
        process.exit(1);
      }
    }

    // Check for help
    if (match.remainingArgs.includes("--help") || match.remainingArgs.includes("-h")) {
      command = await loadCommand(match.route.filePath);
      printCommandHelp(config, match.route, command);
      return;
    }

    // Load the matched command
    command = await loadCommand(match.route.filePath);

    // Run beforeLoad hooks (CLI outer, command inner)
    await runBeforeLoad(config.hooks, command.hooks, match.route, argv);

    // Execute the command
    await executeCommand(command, match, argv, config);
  } catch (error) {
    // Build partial context for error hook if possible
    if (!partialCtx.log) {
      partialCtx = {
        stdin,
        stdout,
        stderr,
        args: [],
        flags: {},
        rawArgv: process.argv.slice(2),
        log: (...msgs: unknown[]) => console.log(...msgs),
        error: (...msgs: unknown[]) => console.error(...msgs),
      };
    }

    // Run onError hooks - if any returns true, swallow the error
    const swallowed = await runOnError(config.hooks, command?.hooks, error, partialCtx);

    if (swallowed) {
      return; // Error was handled, don't exit
    }

    // Handle validation errors with user-friendly output (no stack trace)
    if (error instanceof ValidationError) {
      console.error(error.message);
      process.exit(1);
    }

    // Re-throw other errors to show stack trace for debugging
    throw error;
  }
}
