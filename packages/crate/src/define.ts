import type { ArgTypes, CommandDefinition } from "./types.js";

/**
 * Function type for generating JSON Schema from a schema object.
 * Used by libraries like Valibot that provide JSON Schema export via a separate function.
 */
export type JSONSchemaGenerator = () => object;

/**
 * Helper to define a command with proper type inference
 *
 * Usage:
 * ```ts
 * import { z } from 'zod';
 * import { defineCommand } from 'crate';
 *
 * export default defineCommand({
 *   args: z.tuple([z.string()]),  // Positional arguments
 *   flags: z.object({             // Flags/options
 *     force: z.boolean().default(false),
 *     region: z.string().optional(),
 *   }),
 *   meta: {
 *     description: "Deploy the app",
 *     examples: ["mycli deploy production --force"],
 *   },
 *   async run({ args, flags, log }) {
 *     // args: [string]
 *     // flags: { force: boolean, region?: string }
 *     log(`Deploying to ${args[0]}...`);
 *   },
 * });
 * ```
 */
export function defineCommand<TArgs, TFlags>(def: {
  args?: { "~standard": { types?: { input: TArgs; output: TArgs } } };
  flags?: { "~standard": { types?: { input: TFlags; output: TFlags } } };
  argTypes?: ArgTypes;
  defaults?: Record<string, unknown>;
  toJSONSchema?: JSONSchemaGenerator;
  meta?: { description?: string; examples?: string[]; hidden?: boolean };
  run: (ctx: {
    stdin: NodeJS.ReadStream;
    stdout: NodeJS.WriteStream;
    stderr: NodeJS.WriteStream;
    args: TArgs extends unknown[] ? TArgs : never;
    flags: TFlags extends Record<string, unknown> ? TFlags : never;
    rawArgv: string[];
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  }) => Promise<void> | void;
}): CommandDefinition {
  return {
    default: def.run as CommandDefinition["default"],
    args: def.args as CommandDefinition["args"],
    flags: def.flags as CommandDefinition["flags"],
    argTypes: def.argTypes,
    defaults: def.defaults,
    meta: def.meta,
  };
}
