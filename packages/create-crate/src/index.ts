#!/usr/bin/env node
import { writeFile, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { parse } from "@bomb.sh/args";
import * as p from "@clack/prompts";
import color from "picocolors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function validatePackageName(name: string): string | undefined {
  if (!name) {
    return "Package name is required";
  }
  if (!/^[a-z0-9-._@\/]+$/.test(name)) {
    return "Package name can only contain lowercase letters, numbers, hyphens, dots, underscores, @ and /";
  }
  return undefined;
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

interface ProjectConfig {
  name: string;
  description: string;
  version: string;
  author: string;
  license: string;
  schemaLibrary: "zod" | "valibot" | "arktype" | "none";
  installDependencies: boolean;
}

interface CliFlags {
  name?: string;
  description?: string;
  version?: string;
  author?: string;
  license?: string;
  schema?: string;
  install?: boolean;
  help?: boolean;
  yes?: boolean;
}

function showHelp(): void {
  console.log(`
Usage: create-crate [project-name] [options]

Options:
  --name <name>          Project name (default: prompt)
  --description <desc>   Project description (default: "A crate CLI application")
  --version <version>    Initial version (default: "0.1.0")
  --author <author>      Author name (default: "")
  --license <license>    License type (default: "MIT")
  --schema <library>     Schema library: zod, valibot, arktype, none (default: zod)
  --install, --no-install   Install dependencies (default: true)
  --yes, -y              Use all defaults (non-interactive mode)
  --help, -h             Show this help message

Examples:
  create-crate my-cli
  create-crate my-cli --schema valibot --yes
  create-crate --name my-cli --description "My CLI" --yes
`);
}

async function gatherConfig(): Promise<ProjectConfig> {
  const parsed = parse(process.argv.slice(2), {
    boolean: ["install", "help", "yes"],
    string: ["name", "description", "version", "author", "license", "schema"],
    alias: { h: "help", y: "yes" },
    default: { install: true },
  });

  const flags = parsed as unknown as CliFlags;

  if (flags.help) {
    showHelp();
    process.exit(0);
  }

  // Get project name from positional arg or flag
  let name = flags.name || (parsed._[0] as string | undefined);
  const useDefaults = flags.yes;

  if (useDefaults) {
    // Non-interactive mode with defaults
    if (!name) {
      console.error("Error: Project name is required. Provide it as an argument or use --name");
      process.exit(1);
    }

    const validation = validatePackageName(name);
    if (validation) {
      console.error(`Error: ${validation}`);
      process.exit(1);
    }

    const targetDir = resolve(process.cwd(), name);
    if (await directoryExists(targetDir)) {
      console.error(`Error: Directory "${name}" already exists.`);
      process.exit(1);
    }

    const schemaLibrary = (flags.schema || "zod").toLowerCase() as ProjectConfig["schemaLibrary"];
    if (!["zod", "valibot", "arktype", "none"].includes(schemaLibrary)) {
      console.error(`Error: Invalid schema library "${schemaLibrary}". Choose: zod, valibot, arktype, none`);
      process.exit(1);
    }

    console.log(`Creating ${name} with defaults...\n`);

    return {
      name,
      description: flags.description || "A crate CLI application",
      version: flags.version || "0.1.0",
      author: flags.author || "",
      license: flags.license || "MIT",
      schemaLibrary,
      installDependencies: flags.install !== false,
    };
  }

  // Interactive mode with clack
  p.intro(`${color.bgCyan(color.black(" create-crate "))}`);

  // If name provided via CLI, validate it first
  if (name) {
    const validation = validatePackageName(name);
    if (validation) {
      p.log.error(validation);
      process.exit(1);
    }
    const targetDir = resolve(process.cwd(), name);
    if (await directoryExists(targetDir)) {
      p.log.error(`Directory "${name}" already exists.`);
      process.exit(1);
    }
  }

  const project = await p.group(
    {
      name: () =>
        name
          ? Promise.resolve(name)
          : p.text({
            message: "What is your project name?",
            placeholder: "my-cli",
            validate: (value) => {
              if (!value) return "Please enter a project name.";
              return validatePackageName(value);
            },
          }),
      description: () =>
        p.text({
          message: "What is your project description?",
          placeholder: "A crate CLI application",
          initialValue: flags.description,
        }),
      version: () =>
        p.text({
          message: "What is the initial version?",
          placeholder: "0.1.0",
          initialValue: flags.version || "0.1.0",
        }),
      author: () =>
        p.text({
          message: "Who is the author?",
          placeholder: "Your Name",
          initialValue: flags.author,
        }),
      license: () =>
        p.select({
          message: "Which license do you want to use?",
          initialValue: flags.license || "MIT",
          options: [
            { value: "MIT", label: "MIT" },
            { value: "Apache-2.0", label: "Apache-2.0" },
            { value: "BSD-3-Clause", label: "BSD-3-Clause" },
            { value: "GPL-3.0", label: "GPL-3.0" },
            { value: "ISC", label: "ISC" },
            { value: "UNLICENSED", label: "UNLICENSED" },
          ],
        }),
      schemaLibrary: () =>
        p.select({
          message: "Which schema validation library would you like to use?",
          initialValue: flags.schema || "zod",
          options: [
            { value: "zod", label: "Zod", hint: "Most popular, great TypeScript support" },
            { value: "valibot", label: "Valibot", hint: "Smaller bundle size, tree-shakeable" },
            { value: "arktype", label: "ArkType", hint: "TypeScript-native validation" },
            { value: "none", label: "None", hint: "No schema library" },
          ],
        }),
      installDependencies: () =>
        p.confirm({
          message: "Install dependencies?",
          initialValue: flags.install !== false,
        }),
    },
    {
      onCancel: () => {
        p.cancel("Operation cancelled.");
        process.exit(0);
      },
    }
  );

  // Use the name from CLI if provided, otherwise from prompt
  const finalName = name || (project.name as string);

  // Check if directory already exists (for prompted name)
  if (!name) {
    const targetDir = resolve(process.cwd(), finalName);
    if (await directoryExists(targetDir)) {
      p.log.error(`Directory "${finalName}" already exists.`);
      process.exit(1);
    }
  }

  return {
    name: finalName,
    description: project.description || "A crate CLI application",
    version: project.version || "0.1.0",
    author: project.author || "",
    license: project.license || "MIT",
    schemaLibrary: project.schemaLibrary as ProjectConfig["schemaLibrary"],
    installDependencies: project.installDependencies,
  };
}

function generatePackageJson(config: ProjectConfig): string {
  const deps: Record<string, string> = {
    "@hacksaw/crate": "^0.1.0",
  };
  const devDeps: Record<string, string> = {
    "@types/node": "^22.0.0",
    typescript: "^5.5.0",
  };

  if (config.schemaLibrary === "zod") {
    devDeps["zod"] = "^3.25.0";
  } else if (config.schemaLibrary === "valibot") {
    devDeps["valibot"] = "^1.0.0";
  } else if (config.schemaLibrary === "arktype") {
    devDeps["arktype"] = "^2.0.0";
  }

  const packageJson = {
    name: config.name,
    version: config.version,
    description: config.description,
    type: "module",
    main: "./dist/cli.js",
    bin: {
      [config.name.replace(/^@[^/]+\//, "")]: "./dist/cli.js",
    },
    files: ["dist"],
    scripts: {
      dev: "tsc --watch",
      build: "tsc",
      start: "node ./dist/cli.js",
    },
    keywords: ["cli"],
    author: config.author || undefined,
    license: config.license,
    dependencies: deps,
    devDependencies: devDeps,
  };

  // Remove empty fields
  if (!packageJson.author) delete packageJson.author;

  return JSON.stringify(packageJson, null, 2);
}

function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        lib: ["ES2022"],
        outDir: "./dist",
        rootDir: ".",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
      },
      include: ["**/*.ts"],
      exclude: ["node_modules", "dist"],
    },
    null,
    2
  );
}

function generateCliTs(config: ProjectConfig): string {
  return `import { run } from "@hacksaw/crate";

run({
  name: "${config.name.replace(/^@[^/]+\//, "")}",
  version: "${config.version}",
  description: "${config.description}",
  commandsDir: "./commands",
});
`;
}

function generateIndexCommand(config: ProjectConfig): string {
  if (config.schemaLibrary === "zod") {
    return `import { z } from "zod";

export const args = z.tuple([]).optional();

export const flags = z.object({
  verbose: z.boolean().default(false),
});

export const meta = {
  description: "Root command - shows help or runs default action",
  examples: ["${config.name.replace(/^@[^/]+\//, "")}", "${config.name.replace(/^@[^/]+\//, "")} --verbose"],
};

export default async function ({ log, flags }: { log: (...args: unknown[]) => void; flags: { verbose: boolean } }) {
  if (flags.verbose) {
    log("Running in verbose mode");
  }
  log("Hello from ${config.name}!");
  log("Run \`${config.name.replace(/^@[^/]+\//, "")} --help\` to see available commands");
}
`;
  }

  if (config.schemaLibrary === "valibot") {
    return `import * as v from "valibot";

export const args = v.optional(v.tuple([]));

export const flags = v.object({
  verbose: v.optional(v.boolean(), false),
});

export const meta = {
  description: "Root command - shows help or runs default action",
  examples: ["${config.name.replace(/^@[^/]+\//, "")}", "${config.name.replace(/^@[^/]+\//, "")} --verbose"],
};

export default async function ({ log, flags }: { log: (...args: unknown[]) => void; flags: { verbose: boolean } }) {
  if (flags.verbose) {
    log("Running in verbose mode");
  }
  log("Hello from ${config.name}!");
  log("Run \`${config.name.replace(/^@[^/]+\//, "")} --help\` to see available commands");
}
`;
  }

  if (config.schemaLibrary === "arktype") {
    return `import { type } from "arktype";

export const args = type("[]?");

export const flags = type({
  verbose: "boolean? = false",
});

export const meta = {
  description: "Root command - shows help or runs default action",
  examples: ["${config.name.replace(/^@[^/]+\//, "")}", "${config.name.replace(/^@[^/]+\//, "")} --verbose"],
};

export default async function ({ log, flags }: { log: (...args: unknown[]) => void; flags: { verbose: boolean } }) {
  if (flags.verbose) {
    log("Running in verbose mode");
  }
  log("Hello from ${config.name}!");
  log("Run \`${config.name.replace(/^@[^/]+\//, "")} --help\` to see available commands");
}
`;
  }

  // No schema library - explicit configuration
  return `export const args = undefined;

export const flags = undefined;

export const argTypes = {
  boolean: ["verbose"],
};

export const defaults = {
  verbose: false,
};

export const meta = {
  description: "Root command - shows help or runs default action",
  examples: ["${config.name.replace(/^@[^/]+\//, "")}", "${config.name.replace(/^@[^/]+\//, "")} --verbose"],
};

export default async function ({ log, flags }: { log: (...args: unknown[]) => void; flags: { verbose: boolean } }) {
  if (flags.verbose) {
    log("Running in verbose mode");
  }
  log("Hello from ${config.name}!");
  log("Run \`${config.name.replace(/^@[^/]+\//, "")} --help\` to see available commands");
}
`;
}

function generateExampleCommand(config: ProjectConfig): string {
  const cliName = config.name.replace(/^@[^/]+\//, "");

  if (config.schemaLibrary === "zod") {
    return `import { z } from "zod";

export const args = z.tuple([z.string()]);

export const flags = z.object({
  force: z.boolean().default(false),
});

export const meta = {
  description: "Example command with positional args and flags",
  examples: [
    "${cliName} greet World",
    "${cliName} greet World --force",
  ],
};

export default async function ({ args, flags, log }: { args: [string]; flags: { force: boolean }; log: (...args: unknown[]) => void }) {
  const [name] = args;
  
  log(\`Hello, \${name}!\`);
  
  if (flags.force) {
    log("(Force mode enabled)");
  }
}
`;
  }

  if (config.schemaLibrary === "valibot") {
    return `import * as v from "valibot";

export const args = v.tuple([v.string()]);

export const flags = v.object({
  force: v.optional(v.boolean(), false),
});

export const meta = {
  description: "Example command with positional args and flags",
  examples: [
    "${cliName} greet World",
    "${cliName} greet World --force",
  ],
};

export default async function ({ args, flags, log }: { args: [string]; flags: { force: boolean }; log: (...args: unknown[]) => void }) {
  const [name] = args;
  
  log(\`Hello, \${name}!\`);
  
  if (flags.force) {
    log("(Force mode enabled)");
  }
}
`;
  }

  if (config.schemaLibrary === "arktype") {
    return `import { type } from "arktype";

export const args = type("[string]");

export const flags = type({
  force: "boolean? = false",
});

export const meta = {
  description: "Example command with positional args and flags",
  examples: [
    "${cliName} greet World",
    "${cliName} greet World --force",
  ],
};

export default async function ({ args, flags, log }: { args: [string]; flags: { force: boolean }; log: (...args: unknown[]) => void }) {
  const [name] = args;
  
  log(\`Hello, \${name}!\`);
  
  if (flags.force) {
    log("(Force mode enabled)");
  }
}
`;
  }

  // No schema library
  return `export const args = undefined;

export const flags = undefined;

export const argTypes = {
  boolean: ["force"],
};

export const defaults = {
  force: false,
};

export const meta = {
  description: "Example command with positional args and flags",
  examples: [
    "${cliName} greet World",
    "${cliName} greet World --force",
  ],
};

export default async function ({ args, flags, log }: { args: [string]; flags: { force: boolean }; log: (...args: unknown[]) => void }) {
  const [name] = args;
  
  log(\`Hello, \${name}!\`);
  
  if (flags.force) {
    log("(Force mode enabled)");
  }
}
`;
}

function generateReadme(config: ProjectConfig): string {
  const cliName = config.name.replace(/^@[^/]+\//, "");

  return `# ${config.name}

${config.description}

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the CLI
npm start

# Or run directly
node ./dist/cli.js
\`\`\`

## Development

During development, use the watch mode to automatically rebuild on changes:

\`\`\`bash
npm run dev
\`\`\`

## Commands

### Default command

\`\`\`bash
${cliName}
${cliName} --verbose
\`\`\`

### greet <name>

\`\`\`bash
${cliName} greet World
${cliName} greet World --force
\`\`\`

## Adding New Commands

Create a TypeScript file in the \`commands/\` directory:

\`\`\`typescript
// commands/hello.ts
import { z } from "zod";

export const args = z.tuple([z.string()]);
export const flags = z.object({
  loud: z.boolean().default(false),
});

export const meta = {
  description: "Say hello",
  examples: ["${cliName} hello world", "${cliName} hello world --loud"],
};

export default async function ({ args, flags, log }) {
  const [name] = args;
  const message = flags.loud ? \`HELLO \${name.toUpperCase()}!\` : \`Hello, \${name}!\`;
  log(message);
}
\`\`\`

Subcommands are supported via nested directories:

\`\`\`
commands/
├── index.ts      # ${cliName}
├── greet.ts      # ${cliName} greet <name>
└── db/
    └── migrate.ts  # ${cliName} db migrate <direction>
\`\`\`

## Learn More

- [crate documentation](https://github.com/hacksawsoftware/crate)
- File-based routing for CLI commands
- Standard Schema support (Zod, Valibot, ArkType)
`;
}

function generateGitignore(): string {
  return `# Dependencies
node_modules/
.pnpm-store/

# Build output
dist/
*.js
*.js.map
*.d.ts
*.d.ts.map
!cli.ts

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Environment
.env
.env.local

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
`;
}

async function installDeps(projectDir: string, usePnpm: boolean): Promise<void> {
  const packageManager = usePnpm ? "pnpm" : "npm";

  const s = p.spinner();
  s.start(`Installing via ${packageManager}`);

  return new Promise((resolve, reject) => {
    const child = spawn(packageManager, ["install"], {
      cwd: projectDir,
      stdio: "ignore",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        s.stop(`Installed via ${packageManager}`);
        resolve();
      } else {
        s.stop(`Failed to install via ${packageManager}`);
        reject(new Error(`Installation failed with code ${code}`));
      }
    });

    child.on("error", (err) => {
      s.stop(`Failed to install via ${packageManager}`);
      reject(err);
    });
  });
}

async function scaffoldProject(config: ProjectConfig): Promise<void> {
  const projectDir = resolve(process.cwd(), config.name);

  // Create directories
  await mkdir(projectDir, { recursive: true });
  await mkdir(join(projectDir, "commands"), { recursive: true });

  // Write files
  await writeFile(
    join(projectDir, "package.json"),
    generatePackageJson(config)
  );
  await writeFile(join(projectDir, "tsconfig.json"), generateTsConfig());
  await writeFile(join(projectDir, "cli.ts"), generateCliTs(config));
  await writeFile(
    join(projectDir, "commands", "index.ts"),
    generateIndexCommand(config)
  );
  await writeFile(
    join(projectDir, "commands", "greet.ts"),
    generateExampleCommand(config)
  );
  await writeFile(join(projectDir, "README.md"), generateReadme(config));
  await writeFile(join(projectDir, ".gitignore"), generateGitignore());

  // Install dependencies if requested
  if (config.installDependencies) {
    try {
      const usePnpm = process.env.npm_config_user_agent?.includes("pnpm") ?? false;
      await installDeps(projectDir, usePnpm);
    } catch (error) {
      p.log.warn("Failed to install dependencies. You can install them manually.");
    }
  }

  // Print next steps
  const nextSteps = `cd ${config.name}\n${config.installDependencies ? "" : "npm install\n"}npm run build\nnpm start`;
  p.note(nextSteps, "Next steps");

  p.outro(`Happy coding! ${color.yellow("🎉")}`);
}

// Main
async function main(): Promise<void> {
  try {
    const config = await gatherConfig();
    await scaffoldProject(config);
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
