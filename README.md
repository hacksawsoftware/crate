# crate

A TypeScript CLI metaframework with file-based routing, built on top of `@bomb.sh/args` and Standard Schema.

## Features

- 📁 **File-based routing** - Commands are organized as files and folders
- 🔒 **Type-safe** - Full TypeScript support with Standard Schema validation
- 🏎️ **Fast** - Powered by the ultra-fast `@bomb.sh/args` parser
- 🎯 **Framework-agnostic schemas** - Use Zod, Valibot, ArkType, or any Standard Schema library
- 💻 **Built-in stdio** - Access stdin, stdout, stderr directly from command context
- 🛣️ **Dynamic routes** - Support for `[param]` style dynamic segments

## Installation

```bash
npm install crate
# or
pnpm add crate
# or
yarn add crate
```

## Quick Start

### 1. Create your CLI entry point

```typescript
// cli.ts
import { run } from "crate";

run({
  name: "my-cli",
  version: "1.0.0",
  description: "My awesome CLI tool",
});
```

### 2. Create command files

```typescript
// commands/deploy.ts
import { z } from "zod";

export const args = z.tuple([z.string()]);

export const flags = z.object({
  force: z.boolean().default(false),
  region: z.string().optional(),
});

export const meta = {
  description: "Deploy to an environment",
  examples: ["my-cli deploy production --force"],
};

export default async function ({ args, flags, log }) {
  const [target] = args;
  log(`Deploying to ${target}...`);
  
  if (flags.force) {
    log("Force mode enabled!");
  }
  
  if (flags.region) {
    log(`Region: ${flags.region}`);
  }
}
```

### 3. Run your CLI

```bash
# Using tsx (recommended for development)
npx tsx cli.ts deploy production --force --region us-east-1

# Or with Node.js 22.6+ experimental TypeScript support
node --import crate/register cli.ts deploy production --force
```

## File-Based Routing

The filesystem structure maps directly to command structure:

```
commands/
├── index.ts          # Root command (my-cli)
├── deploy.ts         # Subcommand (my-cli deploy)
├── deploy/
│   └── [target].ts   # Dynamic route (my-cli deploy production)
└── db/
    ├── migrate.ts    # Nested command (my-cli db migrate)
    └── seed.ts       # (my-cli db seed)
```

### Dynamic Routes

Use bracket notation for dynamic parameters:

```typescript
// commands/info/[id].ts
import { z } from "zod";

export const flags = z.object({
  json: z.boolean().default(false),
});

export default async function ({ flags, log }) {
  // Dynamic param is available via flags.id
  const id = flags.id as string;
  log(`Getting info for ${id}`);
}
```

Usage: `my-cli info abc123 --json`

## Command API

Each command file exports:

### Required
- `default` - The command handler function

### Optional
- `args` - Standard Schema for positional arguments (tuple schema)
- `flags` - Standard Schema for flags/options (object schema)
- `meta` - Command metadata

### Handler Context

The handler receives a context object with:

```typescript
{
  stdin,           // NodeJS.ReadStream
  stdout,          // NodeJS.WriteStream
  stderr,          // NodeJS.WriteStream
  args,            // Parsed positional arguments (validated by args schema)
  flags,           // Parsed flags (validated by flags schema, includes dynamic params)
  rawArgv,         // Original process.argv
  log,             // Helper to write to stdout
  error,           // Helper to write to stderr
}
```

### Meta Object

```typescript
export const meta = {
  description: "Deploy the application",
  examples: [
    "my-cli deploy production",
    "my-cli deploy staging --force"
  ],
  hidden: false,  // Set to true to hide from help listing
};
```

## Schema Support

Any Standard Schema-compatible library works. The framework automatically detects argument types when possible, but you can also provide explicit configuration.

### Zod (v4+)
Zod v4+ includes native JSON Schema export. Auto-detection works out of the box:

```typescript
import { z } from "zod";

export const flags = z.object({
  name: z.string(),
  count: z.number().default(1),
  verbose: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});
```

> **Note**: Zod v3 users should upgrade to v4 or provide explicit `argTypes` configuration.

### Valibot
Valibot requires the `@valibot/to-json-schema` package for JSON Schema export (kept separate to minimize bundle size):

```bash
npm install @valibot/to-json-schema
```

```typescript
import * as v from "valibot";
import { toJsonSchema } from "@valibot/to-json-schema";

export const flags = v.object({
  name: v.string(),
  count: v.optional(v.number(), 1),
  verbose: v.optional(v.boolean(), false),
  tags: v.optional(v.array(v.string()), []),
});

// Attach the JSON Schema generator for auto-detection
export const toJSONSchema = () => toJsonSchema(flags);
```

Or use explicit configuration (no extra package needed):

```typescript
export const flags = v.object({
  name: v.string(),
  count: v.optional(v.number(), 1),
  verbose: v.optional(v.boolean(), false),
  tags: v.optional(v.array(v.string()), []),
});

export const argTypes = {
  boolean: ["verbose"],
  string: ["name"],
  array: ["tags"],
};

export const defaults = {
  count: 1,
  verbose: false,
  tags: [],
};
```

### ArkType
ArkType includes native JSON Schema export. Auto-detection works out of the box:

```typescript
import { type } from "arktype";

export const flags = type({
  name: "string",
  count: "number? = 1",
  verbose: "boolean? = false",
  tags: "string[]? = []",
});
```

### Explicit Configuration
For any library, you can provide explicit argument types:

```typescript
export const argTypes = {
  boolean: ["force", "verbose"],  // Flags that don't take values
  string: ["name", "region"],     // Flags that take single values
  array: ["tags"],                // Flags that can repeat (--tags a --tags b)
};

export const defaults = {
  force: false,
  verbose: false,
  tags: [],
};
```

## Configuration Options

```typescript
run({
  name: "my-cli",              // CLI name (required)
  version: "1.0.0",            // Version string
  description: "A great CLI",    // Description for help text
  commandsDir: "./commands",     // Directory containing commands (default: "commands")
});
```

## Error Handling

Validation errors are automatically caught and displayed:

```
$ my-cli deploy
Validation failed:
0: Required
```

## TypeScript Support

### Development

Use `tsx` for the best TypeScript experience:

```bash
npx tsx cli.ts [command]
```

Or with the built-in register (Node.js 22.6+):

```bash
node --import crate/register cli.ts [command]
```

### Production

Compile to JavaScript before distribution:

```bash
npx tsc
node dist/cli.js [command]
```

## API Reference

### `run(config: CliConfig)`

Starts the CLI and handles command routing and execution.

### `defineCommand(def)`

Helper for better type inference:

```typescript
import { defineCommand } from "crate";
import { z } from "zod";

export default defineCommand({
  args: z.tuple([z.string()]),
  flags: z.object({ force: z.boolean() }),
  meta: { description: "Deploy" },
  async run({ args, flags, log }) {
    // Fully typed!
    const [target] = args;  // string
    if (flags.force) {      // boolean
      log("Forcing!");
    }
  },
});
```

### Utility Functions

```typescript
import { 
  scanCommands,     // Scan commands directory
  matchRoute,       // Match argv to routes
  validateWithSchema // Validate data against a schema
} from "crate";
```

## Example

See the `examples/my-cli` directory for a complete working example with:
- Root command with optional flags
- Static subcommands (`deploy`, `db/migrate`)
- Dynamic routes (`info/[id]`)
- Array flags (`--tags`)
- Boolean flags (`--force`, `--json`)
- String flags (`--region`)

## License

MIT
