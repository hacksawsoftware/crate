import type { ArgTypes, CommandDefinition, Context, JSONSchemaGenerator, Hooks } from "./types.js";

/**
 * Helper type to extract the output type from a Standard Schema.
 */
export type InferOutput<T> = T extends { "~standard": { types: { output: infer O } } }
  ? O
  : T extends { _zod: { output: infer O } }  // Fallback for Zod
    ? O
    : unknown;

/**
 * Command definition with type inference from Standard Schema.
 */
interface TypedCommandDefinition<
  TArgs = unknown,
  TFlags = Record<string, unknown>
> {
  args?: { "~standard": { types?: { output: TArgs } } } | { _zod: { output: TArgs } } | undefined;
  flags?: { "~standard": { types?: { output: TFlags } } } | { _zod: { output: TFlags } } | undefined;
  argTypes?: ArgTypes;
  defaults?: Record<string, unknown>;
  toJSONSchema?: JSONSchemaGenerator;
  meta?: { description?: string; examples?: string[]; hidden?: boolean };
  hooks?: Hooks;
  run: (ctx: TypedContext<TArgs, TFlags>) => Promise<void> | void;
}

/**
 * Typed context with properly inferred args and flags.
 */
type TypedContext<TArgs, TFlags> = Omit<Context, "args" | "flags"> & {
  args: TArgs;
  flags: TFlags;
};

/**
 * Helper to define a command with proper type inference.
 *
 * This helper infers types from your schema library (Zod, Valibot, ArkType, etc.).
 * The run function receives fully typed args and flags.
 *
 * @example Using Zod
 * ```ts
 * import { z } from 'zod';
 * import { defineCommand } from '@hacksaw/crate';
 *
 * export default defineCommand({
 *   args: z.tuple([z.string()]),
 *   flags: z.object({
 *     force: z.boolean().default(false),
 *     region: z.string().optional(),
 *   }),
 *   meta: {
 *     description: "Deploy the app",
 *   },
 *   async run({ args, flags, log }) {
 *     // args: [string]
 *     // flags: { force: boolean, region?: string }
 *     const [target] = args;
 *     log(`Deploying to ${target}...`);
 *   },
 * });
 * ```
 *
 * @example Using explicit types (fallback)
 * ```ts
 * import { z } from 'zod';
 * import { defineCommand, type InferOutput } from '@hacksaw/crate';
 *
 * const argsSchema = z.tuple([z.string()]);
 * const flagsSchema = z.object({ force: z.boolean() });
 *
 * export default defineCommand<InferOutput<typeof argsSchema>, InferOutput<typeof flagsSchema>>({
 *   args: argsSchema,
 *   flags: flagsSchema,
 *   async run({ args, flags }) {
 *     // Fully typed!
 *   },
 * });
 * ```
 */
export function defineCommand<TArgs = unknown, TFlags = Record<string, unknown>>(
  def: TypedCommandDefinition<TArgs, TFlags>
): CommandDefinition {
  return {
    default: def.run as CommandDefinition["default"],
    args: def.args as CommandDefinition["args"],
    flags: def.flags as CommandDefinition["flags"],
    argTypes: def.argTypes,
    defaults: def.defaults,
    meta: def.meta,
    toJSONSchema: def.toJSONSchema,
    hooks: def.hooks,
  };
}
