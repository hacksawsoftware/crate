# crate

A TypeScript CLI metaframework with file-based routing, built on top of `@bomb.sh/args` and Standard Schema.

## Features

- 📁 **File-based routing** - Commands are organized as files and folders
- 🔒 **Type-safe** - Full TypeScript support with Standard Schema validation
- 🏎️ **Fast** - Powered by the ultra-fast `@bomb.sh/args` parser
- 🎯 **Framework-agnostic schemas** - Use Zod, Valibot, ArkType, or any Standard Schema library
- 💻 **Built-in stdio** - Access stdin, stdout, stderr directly from command context
- 🛣️ **Dynamic routes** - Support for `[param]` style dynamic segments
- ✨ **`defineCommand` API** - Simple, type-safe command definition with full inference

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
import { run } from "@hacksaw/crate";

run({
  name: "my-cli",
  version: "1.0.0",
  description: "My awesome CLI tool",
});
```

### 2. Create command files

Commands **must** use `defineCommand` for full type inference:

```typescript
// commands/deploy.ts
import { z } from "zod";
import { defineCommand } from "@hacksaw/crate";

export default defineCommand({
  args: z.tuple([z.string()]),
  flags: z.object({
    force: z.boolean().default(false),
    region: z.string().optional(),
  }),
  meta: {
    description: "Deploy to an environment",
    examples: ["my-cli deploy production --force"],
  },
  async run({ args, flags, log }) {
    const [target] = args;  // Fully typed as string
    log(`Deploying to ${target}...`);
    
    if (flags.force) {  // Fully typed as boolean
      log("Force mode enabled!");
    }
    
    if (flags.region) {  // Fully typed as string | undefined
      log(`Region: ${flags.region}`);
    }
  },
});
```
```

### 3. Run your CLI

```bash
# Using jiti (recommended for development)
npx jiti cli.ts deploy production --force --region us-east-1
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
import { defineCommand } from "@hacksaw/crate";

export default defineCommand({
  flags: z.object({
    json: z.boolean().default(false),
  }),
  meta: {
    description: "Get info by ID",
    examples: ["my-cli info abc123 --json"],
  },
  async run({ flags, log }) {
    // Dynamic param is available via flags.id
    const id = flags.id as string;
    log(`Getting info for ${id}`);
    if (flags.json) {
      log(JSON.stringify({ id }));
    }
  },
});
```

Usage: `my-cli info abc123 --json`

## Command API

Commands use `defineCommand` for full type inference and validation:

```typescript
import { defineCommand } from "@hacksaw/crate";
import { z } from "zod";

export default defineCommand({
  // Positional arguments schema (tuple)
  args: z.tuple([z.string(), z.number().optional()]),
  
  // Flags/options schema (object)
  flags: z.object({
    force: z.boolean().default(false),
    region: z.string(),
    tags: z.array(z.string()).default([]),
  }),
  
  // Command metadata
  meta: {
    description: "Deploy the application",
    examples: [
      "my-cli deploy production",
      "my-cli deploy staging --force"
    ],
    hidden: false,  // Set to true to hide from help listing
  },
  
  // Command handler
  async run({ args, flags, log, error, stdin, stdout, stderr, rawArgv }) {
    const [target, retries] = args;
    log(`Deploying to ${target}...`);
  },
});
```

### Handler Context

The `run` handler receives a context object with:

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

## Schema Support

Any Standard Schema-compatible library works. The framework automatically detects argument types when possible, but you can also provide explicit configuration.

### Zod (v4+)
Zod v4+ includes native JSON Schema export. Auto-detection works out of the box:

```typescript
import { defineCommand } from "@hacksaw/crate";
import { z } from "zod";

export default defineCommand({
  args: z.tuple([z.string()]),
  flags: z.object({
    name: z.string(),
    count: z.number().default(1),
    verbose: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
  meta: { description: "Example command" },
  async run({ args, flags, log }) {
    const [target] = args;  // string
    log(`Name: ${flags.name}, Count: ${flags.count}`);
  },
});
```

> **Note**: Zod v3 users should upgrade to v4 or provide explicit `argTypes` configuration.

### Valibot
Valibot requires the `@valibot/to-json-schema` package for JSON Schema export (kept separate to minimize bundle size):

```bash
npm install @valibot/to-json-schema
```

#### Option 1: Attach JSON Schema Generator (Auto-Detection)
```typescript
import { defineCommand } from "@hacksaw/crate";
import * as v from "valibot";
import { toJsonSchema } from "@valibot/to-json-schema";

const flagsSchema = v.object({
  name: v.string(),
  count: v.optional(v.number(), 1),
  verbose: v.optional(v.boolean(), false),
  tags: v.optional(v.array(v.string()), []),
});

export default defineCommand({
  flags: flagsSchema,
  // Attach the JSON Schema generator for auto-detection
  toJSONSchema: () => toJsonSchema(flagsSchema),
  meta: { description: "Example command" },
  async run({ flags, log }) {
    log(`Name: ${flags.name}, Count: ${flags.count}`);
  },
});
```

#### Option 2: Explicit Configuration (No Extra Package)
```typescript
import { defineCommand } from "@hacksaw/crate";
import * as v from "valibot";

export default defineCommand({
  args: v.tuple([v.string()]),
  flags: v.object({
    name: v.string(),
    count: v.optional(v.number(), 1),
    verbose: v.optional(v.boolean(), false),
    tags: v.optional(v.array(v.string()), []),
  }),
  argTypes: {
    boolean: ["verbose"],
    string: ["name"],
    array: ["tags"],
  },
  defaults: {
    count: 1,
    verbose: false,
    tags: [],
  },
  meta: { description: "Example command" },
  async run({ flags, log }) {
    log(`Name: ${flags.name}, Count: ${flags.count}`);
  },
});
```

### ArkType
ArkType includes native JSON Schema export. Auto-detection works out of the box:

```typescript
import { defineCommand } from "@hacksaw/crate";
import { type } from "arktype";

export default defineCommand({
  args: type("[string]"),
  flags: type({
    name: "string",
    count: "number? = 1",
    verbose: "boolean? = false",
    tags: "string[]? = []",
  }),
  meta: { description: "Example command" },
  async run({ args, flags, log }) {
    const [target] = args;  // string
    log(`Name: ${flags.name}, Count: ${flags.count}`);
  },
});
```

### Explicit Configuration
For any library, you can provide explicit argument types:

```typescript
import { defineCommand } from "@hacksaw/crate";

export default defineCommand({
  // Your schema here
  argTypes: {
    boolean: ["force", "verbose"],  // Flags that don't take values
    string: ["name", "region"],       // Flags that take single values
    array: ["tags"],                  // Flags that can repeat (--tags a --tags b)
  },
  defaults: {
    force: false,
    verbose: false,
    tags: [],
  },
  meta: { description: "Example command" },
  async run({ flags, log }) {
    // flags are fully typed
  },
});
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

Use `jiti` for TypeScript execution:

```bash
npx jiti cli.ts [command]
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

```typescript
import { run } from "@hacksaw/crate";

run({
  name: "my-cli",              // CLI name (required)
  version: "1.0.0",            // Version string
  description: "A great CLI",  // Description for help text
  commandsDir: "./commands",    // Directory containing commands (default: "commands")
});
```

### `defineCommand(def)`

**This is the primary API for defining commands.** It provides full type inference from your schema:

```typescript
import { defineCommand } from "@hacksaw/crate";
import { z } from "zod";

export default defineCommand({
  args: z.tuple([z.string()]),
  flags: z.object({ 
    force: z.boolean().default(false),
    region: z.string(),
    tags: z.array(z.string()).default([]),
  }),
  meta: { 
    description: "Deploy",
    examples: ["my-cli deploy production --force"],
  },
  async run({ args, flags, log }) {
    // Fully typed!
    const [target] = args;        // string
    if (flags.force) {            // boolean
      log("Forcing!");
    }
    log(`Region: ${flags.region}`);  // string
    flags.tags.forEach(tag => {   // string[]
      log(`Tag: ${tag}`);
    });
  },
});
```

### Utility Functions

```typescript
import { 
  scanCommands,     // Scan commands directory
  matchRoute,       // Match argv to routes
  validateWithSchema // Validate data against a schema
} from "@hacksaw/crate";
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
