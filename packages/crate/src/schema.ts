import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ParseOptions } from "@bomb.sh/args";

/**
 * CLI argument types for @bomb.sh/args configuration
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
 * Command argument configuration
 * Combines @bomb.sh/args types with Standard Schema for validation
 */
export interface ArgConfig {
  /** Types for @bomb.sh/args parsing */
  types: ArgTypes;
  /** Standard Schema for validating the parsed result */
  schema: StandardSchemaV1;
  /** Default values for flags */
  defaults?: Record<string, unknown>;
  /** Aliases (e.g., { h: "help" }) */
  aliases?: Record<string, string>;
}

/**
 * Build @bomb.sh/args ParseOptions from ArgConfig
 */
export function buildParseOptions(config: ArgConfig): ParseOptions {
  return {
    boolean: config.types.boolean,
    string: config.types.string,
    array: config.types.array,
    default: config.defaults,
    alias: config.aliases,
  };
}

/**
 * Validate parsed arguments against a Standard Schema
 */
export async function validateWithSchema<T>(
  schema: StandardSchemaV1<unknown, T>,
  value: unknown
): Promise<T> {
  const result = await schema["~standard"].validate(value);

  if (result.issues) {
    const messages = result.issues.map((i) =>
      i.path ? `${i.path.join(".")}: ${i.message}` : i.message
    );
    throw new Error(`Validation failed:\n${messages.join("\n")}`);
  }

  return result.value as T;
}

/**
 * Parse argv using @bomb.sh/args with the given config
 */
export async function parseAndValidate<T>(
  config: ArgConfig,
  argv: string[]
): Promise<T> {
  const { parse } = await import("@bomb.sh/args");
  const options = buildParseOptions(config);
  const parsed = parse(argv, options);

  return validateWithSchema(config.schema as StandardSchemaV1<unknown, T>, parsed);
}

/**
 * Helper to create an ArgConfig with explicit types
 * This is just for convenience - users can use any Standard Schema library
 */
export function createArgConfig<T>(
  schema: StandardSchemaV1<unknown, T>,
  types: ArgTypes = {},
  defaults?: Record<string, unknown>,
  aliases?: Record<string, string>
): ArgConfig & { _type: T } {
  return {
    types,
    schema,
    defaults,
    aliases,
    // Phantom type for type inference
    _type: undefined as unknown as T,
  };
}

// ============================================================================
// JSON Schema Introspection
// ============================================================================

/**
 * JSON Schema type definitions (subset we care about for CLI args)
 */
interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  default?: unknown;
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  allOf?: JSONSchema[];
  enum?: unknown[];
  const?: unknown;
}

/**
 * User-provided function to generate JSON Schema (for libraries like Valibot)
 * @example
 * ```ts
 * import { toJsonSchema } from '@valibot/to-json-schema';
 * import * as v from 'valibot';
 * 
 * export const flags = v.object({
 *   force: v.boolean(),
 * });
 * 
 * // Attach the JSON Schema generator
 * export const toJSONSchema = () => toJsonSchema(flags);
 * ```
 */
export type JSONSchemaGenerator = () => object;

/**
 * Extract JSON Schema from a schema object using available methods
 * Tries multiple naming conventions (toJSONSchema, toJsonSchema)
 */
function extractJSONSchema(schema: unknown): JSONSchema | null {
  if (!schema || typeof schema !== "object") {
    return null;
  }

  const schemaObj = schema as Record<string, unknown>;

  // Try toJSONSchema (Zod v4+ style)
  if (typeof schemaObj.toJSONSchema === "function") {
    try {
      const result = schemaObj.toJSONSchema();
      if (result && typeof result === "object") {
        return result as JSONSchema;
      }
    } catch {
      // Method exists but failed, continue to other options
    }
  }

  // Try toJsonSchema (ArkType style, or user-attached function for Valibot)
  if (typeof schemaObj.toJsonSchema === "function") {
    try {
      const result = schemaObj.toJsonSchema();
      if (result && typeof result === "object") {
        return result as JSONSchema;
      }
    } catch {
      // Method exists but failed, continue to other options
    }
  }

  // Check for ~standard.getJSONSchema (StandardJSONSchemaV1 spec)
  const standard = schemaObj["~standard"] as
    | {
        getJSONSchema?: () => unknown;
      }
    | undefined;
  if (standard && typeof standard.getJSONSchema === "function") {
    try {
      const result = standard.getJSONSchema();
      if (result && typeof result === "object") {
        return result as JSONSchema;
      }
    } catch {
      // Method exists but failed
    }
  }

  return null;
}

/**
 * Get the effective type from a JSON Schema
 * Handles unions, enums, const, and nested structures
 */
function getEffectiveType(schema: JSONSchema): string | null {
  // Direct type
  if (schema.type && typeof schema.type === "string") {
    return schema.type;
  }

  // Array of types - return first non-null type
  if (Array.isArray(schema.type)) {
    const nonNull = schema.type.find((t) => t !== "null");
    return nonNull || null;
  }

  // Enum implies string type
  if (schema.enum && schema.enum.length > 0) {
    return "string";
  }

  // Const implies the type of the const value
  if (schema.const !== undefined) {
    return typeof schema.const;
  }

  // Check union types for boolean/array hints
  const unions = [...(schema.anyOf || []), ...(schema.oneOf || [])];
  if (unions.length > 0) {
    // If any branch is boolean, prefer that for CLI args
    const hasBoolean = unions.some(
      (s) => getEffectiveType(s) === "boolean"
    );
    if (hasBoolean) return "boolean";

    // If any branch is array, note that
    const hasArray = unions.some((s) => getEffectiveType(s) === "array");
    if (hasArray) return "array";

    // Return first non-null type from unions
    for (const subSchema of unions) {
      const type = getEffectiveType(subSchema);
      if (type && type !== "null") return type;
    }
  }

  return null;
}

/**
 * Extract flag configuration from a JSON Schema
 */
function extractFlagsFromJSONSchema(jsonSchema: JSONSchema): {
  boolean: string[];
  string: string[];
  array: string[];
  defaults: Record<string, unknown>;
} {
  const boolean: string[] = [];
  const string: string[] = [];
  const array: string[] = [];
  const defaults: Record<string, unknown> = {};

  // Must be an object schema with properties
  if (jsonSchema.type !== "object" || !jsonSchema.properties) {
    return { boolean, string, array, defaults };
  }

  for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
    const effectiveType = getEffectiveType(propSchema);

    // Extract default value
    if (propSchema.default !== undefined) {
      defaults[key] = propSchema.default;
    }

    // Classify by type
    switch (effectiveType) {
      case "boolean":
        boolean.push(key);
        // Boolean flags default to false if no explicit default
        if (!(key in defaults)) {
          defaults[key] = false;
        }
        break;

      case "array":
        array.push(key);
        // Array flags default to empty array if no explicit default
        if (!(key in defaults)) {
          defaults[key] = [];
        }
        break;

      case "string":
      case "number":
      case "integer":
      default:
        // Treat unknown types as strings for argument parsing
        string.push(key);
        break;
    }
  }

  return { boolean, string, array, defaults };
}

/**
 * Result of attempting to extract flag configuration from a schema
 */
export interface ExtractFlagsResult {
  /** Whether extraction succeeded */
  success: boolean;
  /** The extracted configuration */
  config: {
    boolean: string[];
    string: string[];
    array: string[];
    defaults: Record<string, unknown>;
  };
  /** Error message if extraction failed */
  error?: string;
}

/**
 * Extract flag configuration from a schema object
 * Works with any library that supports JSON Schema export (Zod v4+, ArkType, Valibot with @valibot/to-json-schema)
 * Falls back to explicit configuration if available
 */
export function extractSchemaFlags(
  schema: unknown,
  explicitConfig?: { boolean?: string[]; string?: string[]; array?: string[]; defaults?: Record<string, unknown> }
): ExtractFlagsResult {
  // Try JSON Schema extraction first
  const jsonSchema = extractJSONSchema(schema);

  if (jsonSchema) {
    const config = extractFlagsFromJSONSchema(jsonSchema);
    return {
      success: true,
      config,
    };
  }

  // Fall back to explicit configuration (only if it has actual values)
  const hasExplicitConfig = explicitConfig && (
    (explicitConfig.boolean && explicitConfig.boolean.length > 0) ||
    (explicitConfig.string && explicitConfig.string.length > 0) ||
    (explicitConfig.array && explicitConfig.array.length > 0) ||
    (explicitConfig.defaults && Object.keys(explicitConfig.defaults).length > 0)
  );
  
  if (hasExplicitConfig) {
    return {
      success: true,
      config: {
        boolean: explicitConfig.boolean ?? [],
        string: explicitConfig.string ?? [],
        array: explicitConfig.array ?? [],
        defaults: explicitConfig.defaults ?? {},
      },
    };
  }

  // No extraction method available
  return {
    success: false,
    config: { boolean: [], string: [], array: [], defaults: {} },
    error:
      "Could not extract flag configuration from schema. " +
      "The schema library may not support JSON Schema export. " +
      "Please provide explicit argTypes configuration.",
  };
}

/**
 * Get the vendor name from a Standard Schema
 */
export function getSchemaVendor(schema: unknown): string | null {
  if (!schema || typeof schema !== "object") {
    return null;
  }

  const standard = (schema as Record<string, unknown>)["~standard"] as
    | { vendor?: string }
    | undefined;

  return standard?.vendor ?? null;
}
