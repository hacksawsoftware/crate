import type { StandardSchemaV1 } from "@standard-schema/spec";
import { styleText } from "node:util";

// ============================================================================
// Validation Error
// ============================================================================

/**
 * Custom error class for validation failures with user-friendly formatting
 */
export class ValidationError extends Error {
  /** The validation issues from Standard Schema */
  public issues: readonly StandardSchemaV1.Issue[];
  /** The context being validated ('args' or 'flags') */
  public context: 'args' | 'flags';

  constructor(
    issues: readonly StandardSchemaV1.Issue[],
    context: 'args' | 'flags',
    commandName?: string
  ) {
    const formattedMessage = ValidationError.formatIssues(issues, context, commandName);
    super(formattedMessage);
    this.issues = issues;
    this.context = context;
    this.name = 'ValidationError';
  }

  /**
   * Format validation issues into a user-friendly error message
   */
  private static formatIssues(
    issues: readonly StandardSchemaV1.Issue[],
    context: 'args' | 'flags',
    commandName?: string
  ): string {
    // Group issues by path for cleaner output
    const formattedErrors = issues.map(issue => {
      const path = issue.path?.length ? issue.path.join('.') : '';
      const userFriendlyPath = this.formatPath(path, context);
      const message = this.formatMessage(issue.message, path, context);
      return { path: userFriendlyPath, message, originalPath: path };
    });

    // Build the error message
    const lines: string[] = [];
    
    // Header based on error type - colored red for error
    const hasMissingRequired = issues.some(i => 
      i.message.toLowerCase().includes('required') ||
      i.message.toLowerCase().includes('expected') && i.message.toLowerCase().includes('received undefined')
    );
    
    const headerText = hasMissingRequired
      ? `Validation failed: Missing required ${context === 'args' ? 'argument' : 'flag'}`
      : `Validation failed: Invalid ${context}`;
    lines.push(styleText('red', headerText));
    lines.push('');

    // List the specific errors - path in yellow, message in white
    for (const error of formattedErrors) {
      if (error.path) {
        const coloredPath = styleText('yellow', error.path);
        lines.push(`  ${coloredPath}: ${error.message}`);
      } else {
        lines.push(`  ${error.message}`);
      }
    }

    // Add help suggestion - dimmed/gray
    lines.push('');
    if (commandName) {
      const dimmed = styleText('dim', `Run \`${commandName} --help\` for usage information.`);
      lines.push(dimmed);
    } else {
      const dimmed = styleText('dim', 'Run with `--help` for usage information.');
      lines.push(dimmed);
    }

    return lines.join('\n');
  }

  /**
   * Format a path into a user-friendly format
   */
  private static formatPath(path: string, context: 'args' | 'flags'): string {
    if (!path) return '';
    
    if (context === 'args') {
      // For args (tuples), show as args[N]
      const index = parseInt(path, 10);
      if (!isNaN(index)) {
        return `args[${index}]`;
      }
      return `args.${path}`;
    } else {
      // For flags (objects), show as flags.<name>
      return `flags.${path}`;
    }
  }

  /**
   * Format a validation message to be more user-friendly
   */
  private static formatMessage(message: string, _path: string, _context: 'args' | 'flags'): string {
    // Make common Zod/validation messages more user-friendly
    let formatted = message;

    // Clean up "expected X, received Y" messages
    if (message.includes('expected') && message.includes('received')) {
      // Extract the expected type
      const expectedMatch = message.match(/expected (\w+)/i);
      const receivedMatch = message.match(/received (\w+)/i);
      
      if (expectedMatch && receivedMatch) {
        const expected = expectedMatch[1];
        const received = receivedMatch[1];
        
        if (received === 'undefined') {
          formatted = `Expected ${expected} but no value was provided`;
        } else {
          formatted = `Expected ${expected} but received ${received}`;
        }
      }
    }

    // Clean up "Required" messages
    if (message.toLowerCase().includes('required')) {
      formatted = 'This value is required';
    }

    // Clean up "Invalid input" prefix
    formatted = formatted.replace(/^Invalid input[:\s]*/i, '');
    formatted = formatted.replace(/^Invalid\s*/i, '');

    // Capitalize first letter
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    return formatted;
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate parsed arguments against a Standard Schema
 */
export async function validateWithSchema<T>(
  schema: StandardSchemaV1<unknown, T>,
  value: unknown,
  context: 'args' | 'flags' = 'flags',
  commandName?: string
): Promise<T> {
  const result = await schema["~standard"].validate(value);

  if (result.issues) {
    throw new ValidationError(result.issues, context, commandName);
  }

  return result.value as T;
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
