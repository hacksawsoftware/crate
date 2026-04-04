import type { StandardSchemaV1 } from "@standard-schema/spec";

export type { StandardSchemaV1 };

/**
 * CLI argument types for explicit configuration
 */
export interface ArgTypes {
  /** Flags that are treated as booleans (no value after them) */
  boolean?: string[];
  /** Flags that are treated as strings (value after them) */
  string?: string[];
  /** Flags that can be repeated (collect into array) */
  array?: string[];
}

/**
 * Lifecycle hooks for command execution
 */
export interface Hooks {
  /** Called before route matching - can modify argv */
  beforeMatch?: (ctx: {
    argv: string[];
  }) => Promise<{ argv?: string[] } | void> | { argv?: string[] } | void;

  /** Called after route match, before loading command */
  beforeLoad?: (ctx: { route: CommandRoute; argv: string[] }) => Promise<void> | void;

  /** Called before command execution - can modify context (middleware pattern) */
  beforeRun?: (ctx: Context) => Promise<Context | void> | Context | void;

  /** Called after successful command execution */
  afterRun?: (ctx: Context) => Promise<void> | void;

  /** Called on any error - return true to swallow error (prevent exit) */
  onError?: (error: unknown, ctx: Partial<Context>) => Promise<boolean | void> | boolean | void;
}

/**
 * Command execution context
 */
export interface Context {
  /** Standard input stream */
  stdin: NodeJS.ReadStream;
  /** Standard output stream */
  stdout: NodeJS.WriteStream;
  /** Standard error stream */
  stderr: NodeJS.WriteStream;
  /** The parsed positional arguments */
  args: unknown[];
  /** The parsed flags/options */
  flags: Record<string, unknown>;
  /** Raw process.argv (for advanced use cases) */
  rawArgv: string[];
  /** Helper to write to stdout */
  log: (...args: unknown[]) => void;
  /** Helper to write to stderr */
  error: (...args: unknown[]) => void;
}

/**
 * Command handler function type
 */
export type CommandHandler = (ctx: Context) => Promise<void> | void;

/**
 * Command metadata
 */
export interface CommandMeta {
  /** Command description for help text */
  description?: string;
  /** Usage examples */
  examples?: string[];
  /** Whether to hide from help listing */
  hidden?: boolean;
}

/**
 * Function type for generating JSON Schema from a schema object.
 * Used by libraries like Valibot that provide JSON Schema export via a separate function.
 */
export type JSONSchemaGenerator = () => object;

/**
 * Command definition - what each command file exports
 */
export interface CommandDefinition {
  /** The command handler function (default export) */
  default: CommandHandler;
  /** Positional arguments schema (Standard Schema compatible) */
  args?: StandardSchemaV1<unknown, unknown[]>;
  /** Flags/options schema (Standard Schema compatible) */
  flags?: StandardSchemaV1<unknown, Record<string, unknown>>;
  /** Command metadata */
  meta?: CommandMeta;
  /**
   * Explicit argument types for CLI parsing.
   * Only needed if the schema library doesn't support JSON Schema export.
   * Most libraries (Zod v4+, ArkType, Valibot with @valibot/to-json-schema)
   * will auto-detect types from the schema.
   */
  argTypes?: ArgTypes;
  /**
   * Default values for flags.
   * Usually auto-detected from schema, but can be overridden here.
   */
  defaults?: Record<string, unknown>;
  /**
   * Optional JSON Schema generator function for libraries like Valibot
   * that don't have native JSON Schema export on the schema object itself.
   */
  toJSONSchema?: JSONSchemaGenerator;
  /**
   * Lifecycle hooks for this specific command.
   * These run inside CLI-level hooks (bubble up pattern).
   */
  hooks?: Hooks;
}

/**
 * Discovered command route
 */
export interface CommandRoute {
  /** The file path to the command */
  filePath: string;
  /** The command path segments (e.g., ['db', 'migrate']) */
  segments: string[];
  /** Dynamic parameter names in the path */
  params: string[];
  /** Whether this is a dynamic route */
  isDynamic: boolean;
}

/**
 * CLI configuration options
 */
export interface CliConfig {
  /** Name of the CLI (used in help text) */
  name: string;
  /** Version string */
  version?: string;
  /** Description */
  description?: string;
  /** Directory containing command files (default: 'commands') */
  commandsDir?: string;
  /**
   * Global lifecycle hooks for all commands.
   * These run outside command-level hooks (bubble up pattern).
   */
  hooks?: Hooks;
}
