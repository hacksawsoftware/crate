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
} from "./types.js";
import { scanCommands } from "./scanner.js";
import { matchRoute, findRootCommand, type RouteMatch } from "./router.js";
import { validateWithSchema, extractSchemaFlags, getSchemaVendor } from "./schema.js";

// Re-exports
export { scanCommands } from "./scanner.js";
export { matchRoute, findRootCommand } from "./router.js";
export { validateWithSchema, extractSchemaFlags, getSchemaVendor } from "./schema.js";
export { defineCommand } from "./define.js";
export type { CliConfig, CommandDefinition, Context, CommandRoute, ArgTypes, JSONSchemaGenerator };

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
      `Command at ${filePath} must export a default command definition created with defineCommand()`
    );
  }
  
  const command = module.default as Partial<CommandDefinition>;
  
  // Ensure the required 'default' handler property exists
  if (typeof command.default !== "function") {
    throw new Error(
      `Command at ${filePath} must have a handler function. Use defineCommand({ run: ... }) to create your command.`
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
  rawArgv: string[]
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
  remainingArgs: string[]
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
      `CLI parsing may not work correctly. Consider providing explicit 'argTypes' in your command definition.`
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
    await validateWithSchema(command.flags, flags);
  }
  
  // Validate args if schema provided
  if (command.args) {
    await validateWithSchema(command.args, positional);
  }
  
  return { args: positional, flags };
}

/**
 * Execute a command with the given match
 */
async function executeCommand(
  command: CommandDefinition,
  match: RouteMatch,
  rawArgv: string[]
): Promise<void> {
  const { args, flags } = await parseCommand(command, match.remainingArgs);
  
  // Add path params to flags for easy access
  const mergedFlags = { ...flags, ...match.params };
  
  const ctx = createContext(args as string[], mergedFlags, rawArgv);
  await command.default(ctx);
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
    const commandName = route.segments.map(s => 
      s.startsWith("[") && s.endsWith("]") ? `<${s.slice(1, -1)}>` : s
    ).join(" ");
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
  command: CommandDefinition
): void {
  const commandName = route.segments
    .filter(s => s !== "index")
    .map(s => s.startsWith("[") && s.endsWith("]") ? `<${s.slice(1, -1)}>` : s)
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
  const commandsDir = config.commandsDir ?? "commands";
  
  // Scan for commands
  const routes = await scanCommands(commandsDir);
  
  if (routes.length === 0) {
    console.error(`No commands found in ${commandsDir}`);
    process.exit(1);
  }
  
  // Get argv (skip node and script path)
  const argv = process.argv.slice(2);
  
  // Try to match a route
  const match = matchRoute(routes, argv);
  
  if (!match) {
    // Check for help flags
    if (argv.includes("--help") || argv.includes("-h")) {
      printHelp(config, routes);
      return;
    }
    
    // Try root command
    const rootRoute = findRootCommand(routes);
    if (rootRoute) {
      const command = await loadCommand(rootRoute.filePath);
      await executeCommand(command, { 
        route: rootRoute,
        params: {},
        remainingArgs: argv,
      }, argv);
      return;
    }
    
    console.error(`Unknown command: ${argv.join(" ")}`);
    printHelp(config, routes);
    process.exit(1);
  }
  
  // Check for help
  if (match.remainingArgs.includes("--help") || match.remainingArgs.includes("-h")) {
    const command = await loadCommand(match.route.filePath);
    printCommandHelp(config, match.route, command);
    return;
  }
  
  // Load and execute the matched command
  const command = await loadCommand(match.route.filePath);
  await executeCommand(command, match, argv);
}
