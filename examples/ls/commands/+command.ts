import * as v from "valibot";
import { defineCommand } from "@hacksaw/crate";
import { readdirSync, statSync, type Stats } from "node:fs";
import { join, resolve } from "node:path";

// Helper to format file size
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "K", "M", "G", "T"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)}${units[i]}`;
}

// Helper to format date
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } else if (days < 365) {
    return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  }
}

// Helper to get file indicator
function getIndicator(stats: Stats, flags: { classify: boolean }): string {
  if (!flags.classify) return "";
  if (stats.isDirectory()) return "/";
  if (stats.isSymbolicLink()) return "@";
  if (stats.isFIFO()) return "|";
  if (stats.isSocket()) return "=";
  // Check if executable (Unix only)
  if (process.platform !== "win32") {
    const mode = stats.mode;
    if (mode & 0o111) return "*";
  }
  return "";
}

export default defineCommand({
  args: v.optional(v.tuple([v.string()]), ["."]),
  flags: v.object({
    all: v.optional(v.boolean(), false),
    long: v.optional(v.boolean(), false),
    classify: v.optional(v.boolean(), false),
    recursive: v.optional(v.boolean(), false),
    "almost-all": v.optional(v.boolean(), false),
  }),
  // Explicit configuration for argTypes since valibot doesn't have built-in JSON Schema export
  argTypes: {
    boolean: ["all", "long", "classify", "recursive", "almost-all"],
  },
  defaults: {
    all: false,
    long: false,
    classify: false,
    recursive: false,
    "almost-all": false,
  },
  meta: {
    description: "List directory contents",
    examples: [
      "ls-example",
      "ls-example /path/to/dir",
      "ls-example --all",
      "ls-example --long",
      "ls-example -la",
      "ls-example --recursive",
    ],
  },
  async run({ args, flags, log, error }) {
    const [pathArg] = args;
    const targetPath = resolve(pathArg);

    // Show hidden files if --all or --almost-all is set
    const showHidden = flags.all || (flags["almost-all"] as boolean);
    // --almost-all hides . and .. entries
    const hideDotDirs = flags["almost-all"] as boolean;

    try {
      const entries = readdirSync(targetPath, { withFileTypes: true });

      const files: Array<{
        name: string;
        stats: Stats;
        isDir: boolean;
        isLink: boolean;
      }> = [];

      for (const entry of entries) {
        // Skip hidden files unless --all or --almost-all
        if (!showHidden && entry.name.startsWith(".")) {
          continue;
        }

        // Skip . and .. for --almost-all
        if (hideDotDirs && (entry.name === "." || entry.name === "..")) {
          continue;
        }

        try {
          const fullPath = join(targetPath, entry.name);
          const stats = statSync(fullPath);
          files.push({
            name: entry.name,
            stats,
            isDir: entry.isDirectory(),
            isLink: entry.isSymbolicLink(),
          });
        } catch {
          // If we can't stat the file, skip it
          continue;
        }
      }

      // Sort: directories first, then alphabetically
      files.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      });

      if (flags.long) {
        // Long format: permissions, owner, size, date, name
        for (const file of files) {
          const size = formatSize(file.stats.size);
          const date = formatDate(file.stats.mtime);
          const indicator = getIndicator(file.stats, flags as { classify: boolean });
          const typeIndicator = file.isDir ? "d" : file.isLink ? "l" : "-";
          const perms = process.platform === "win32" ? "---" : "rwxrwxrwx"; // Simplified
          log(`${typeIndicator}${perms} ${size.padStart(6)} ${date.padStart(20)} ${file.name}${indicator}`);
        }
      } else {
        // Simple format
        for (const file of files) {
          const indicator = getIndicator(file.stats, flags as { classify: boolean });
          log(`${file.name}${indicator}`);
        }
      }

      // Handle recursive listing
      if (flags.recursive) {
        for (const file of files) {
          if (file.isDir) {
            log("");
            log(`${join(targetPath, file.name)}:`);
            // Recursively list subdirectory (would need proper implementation)
            // For simplicity, we just note it here
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        error(`ls: cannot access '${pathArg}': No such file or directory`);
      } else if ((err as NodeJS.ErrnoException).code === "EACCES") {
        error(`ls: cannot open directory '${pathArg}': Permission denied`);
      } else {
        error(`ls: error reading '${pathArg}': ${message}`);
      }
      process.exit(1);
    }
  },
});
