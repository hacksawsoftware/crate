<!-- Added: 2026-04-04 -->
## Project Overview
This is **crate**, a TypeScript CLI metaframework with file-based routing built on @bomb.sh/args and Standard Schema.

## Architecture Decisions

### File-Based Routing
- Commands are defined as files in a `commands/` directory
- Folder structure maps to command hierarchy: `commands/db/migrate.ts` → `my-cli db migrate`
- Dynamic routes use bracket notation: `commands/info/[id].ts` → `my-cli info <id>`
- Route parameters are available in `ctx.flags` (e.g., `ctx.flags.id`)

### Schema Integration
- Uses Standard Schema (@standard-schema/spec) for validation
- Supports any Standard Schema-compatible library (Zod, Valibot, ArkType, etc.)
- Flag types are auto-detected from Zod schemas (boolean, string, array)
- Defaults are extracted from schema definitions

### Argument Parsing
- Built on @bomb.sh/args (<1kB, fast)
- Two-phase parsing: @bomb.sh/args for CLI parsing, Standard Schema for validation
- Router matches command path, remaining args are parsed by the command

### Context Object
Commands receive a context with:
- stdin, stdout, stderr (direct Node.js streams)
- args: parsed positional arguments
- flags: parsed flags (includes dynamic route params)
- rawArgv: original process.argv
- log/error: helper functions for output

## Project Structure
```
src/
├── index.ts      # Main runner and command execution
├── scanner.ts    # Filesystem scanning for command discovery
├── router.ts     # Route matching algorithm
├── schema.ts     # Schema extraction and validation
├── define.ts     # Helper for type-safe command definitions
├── types.ts      # Core TypeScript interfaces
└── register.ts   # TypeScript loader hook
```

## Usage Pattern
```typescript
// commands/deploy.ts
import { z } from "zod";

export const args = z.tuple([z.string()]);
export const flags = z.object({
  force: z.boolean().default(false),
});
export const meta = {
  description: "Deploy the app",
  examples: ["my-cli deploy production --force"],
};

export default async function ({ args, flags, log }) {
  const [target] = args;
  log(`Deploying to ${target}...`);
  if (flags.force) log("Force mode!");
}
```

<!-- Added: 2026-04-04 -->
## Schema Introspection via JSON Schema

The framework now uses JSON Schema export for library-agnostic schema introspection instead of Zod-specific internal APIs.

### Supported Libraries

#### Zod v4+
Native support via `.toJSONSchema()` method:
```typescript
import { z } from "zod";

export const flags = z.object({
  force: z.boolean().default(false),
  region: z.string(),
  tags: z.array(z.string()),
});
// Auto-detected - no additional setup needed
```

#### ArkType
Native support via `.toJsonSchema()` method:
```typescript
import { type } from "arktype";

export const flags = type({
  force: "boolean? = false",
  region: "string",
  tags: "string[]? = []",
});
// Auto-detected - no additional setup needed
```

#### Valibot
Requires `@valibot/to-json-schema` package. Since Valibot keeps bundle size minimal by design, JSON Schema export is provided via a separate package:

```typescript
import * as v from "valibot";
import { toJsonSchema } from "@valibot/to-json-schema";

export const flags = v.object({
  force: v.optional(v.boolean(), false),
  region: v.string(),
  tags: v.optional(v.array(v.string()), []),
});

// Attach the JSON Schema generator for auto-detection
export const toJSONSchema = () => toJsonSchema(flags);
```

Or use explicit configuration:
```typescript
export const flags = v.object({ ... });
export const argTypes = {
  boolean: ["force"],
  string: ["region"],
  array: ["tags"],
};
export const defaults = { force: false, tags: [] };
```

<!-- Added: 2026-04-04 -->
## Valibot JSON Schema Support

Valibot requires the `@valibot/to-json-schema` package for JSON Schema export since Valibot keeps bundle size minimal by design. Users have two options:

### Option 1: Attach JSON Schema Generator (Auto-Detection)
```typescript
import * as v from "valibot";
import { toJsonSchema } from "@valibot/to-json-schema";

export const flags = v.object({
  force: v.optional(v.boolean(), false),
  region: v.string(),
  tags: v.optional(v.array(v.string()), []),
});

// Attach the JSON Schema generator for auto-detection
export const toJSONSchema = () => toJsonSchema(flags);
```

### Option 2: Explicit Configuration (No Extra Package)
```typescript
export const flags = v.object({ ... });
export const argTypes = {
  boolean: ["force"],
  string: ["region"],
  array: ["tags"],
};
export const defaults = { force: false, tags: [] };
```

The framework detects JSON Schema via:
- `schema.toJSONSchema()` - Zod v4+ native method
- `schema.toJsonSchema()` - ArkType native method, or user-attached function for Valibot
- `schema['~standard'].getJSONSchema()` - StandardJSONSchemaV1 spec

### How It Works
1. The framework attempts to extract JSON Schema from schema objects using:
   - `schema.toJSONSchema()` (Zod v4+ style)
   - `schema.toJsonSchema()` (ArkType style, or user-attached function)
   - `schema['~standard'].getJSONSchema()` (StandardJSONSchemaV1 spec)

2. If JSON Schema extraction succeeds, the framework parses the schema to determine:
   - Which flags are booleans (for `--flag` without value)
   - Which flags are arrays (for repeatable flags)
   - Default values for flags

3. If extraction fails, a warning is shown and explicit `argTypes` can be provided as fallback.

### Migration Notes
- **Zod v3**: Upgrade to v4 or provide explicit `argTypes`
- **Valibot**: Install `@valibot/to-json-schema` or use explicit configuration
- **Others**: Provide explicit `argTypes` and `defaults` in command definitions
- The framework is no longer tied to Zod internals and works with any Standard Schema library that supports JSON Schema export
