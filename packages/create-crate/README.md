# create-crate

Create a new [crate](https://github.com/hacksawsoftware/crate) CLI application with one command.

## Usage

```bash
# npm
npm create crate@latest

# pnpm
pnpm create crate

# yarn
yarn create crate
```

## Interactive Mode

Running the command without arguments will start an interactive prompt:

```bash
npm create crate
# ? Project name: my-cli
# ? Description: My awesome CLI tool
# ? Version: 0.1.0
# ? Author: Your Name
# ? License: MIT
# ? Schema library: zod
# ? Install dependencies: Yes
```

## Non-Interactive Mode

Use the `--yes` flag to skip prompts and use defaults:

```bash
npm create crate my-cli --yes
```

Or specify all options via CLI flags:

```bash
npm create crate my-cli \
  --description "My CLI" \
  --author "Your Name" \
  --schema valibot \
  --yes
```

## CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--name` | Project name | Prompt if not provided |
| `--description` | Project description | `"A crate CLI application"` |
| `--version` | Initial version | `"0.1.0"` |
| `--author` | Author name | `""` |
| `--license` | License type | `"MIT"` |
| `--schema` | Schema library (zod, valibot, arktype, none) | `zod` |
| `--install` / `--no-install` | Install dependencies | `true` |
| `--yes`, `-y` | Use all defaults (non-interactive) | `false` |
| `--help`, `-h` | Show help | - |

## Schema Libraries

The following validation libraries are supported:

- **zod** - Most popular, great TypeScript support
- **valibot** - Smaller bundle size, tree-shakeable  
- **arktype** - TypeScript-native, no separate validation needed
- **none** - No schema library (uses explicit argTypes)

## Generated Project Structure

```
my-cli/
├── cli.ts           # Entry point
├── package.json     # Dependencies and scripts
├── tsconfig.json    # TypeScript configuration
├── README.md        # Documentation
├── .gitignore       # Git ignore rules
└── commands/
    ├── index.ts     # Root command (default)
    └── greet.ts     # Example command
```

## Development

After creating a project, you can immediately run it in development mode:

```bash
cd my-cli
npm run dev
```

Or build and run:

```bash
npm run build
npm start
```

## License

MIT
