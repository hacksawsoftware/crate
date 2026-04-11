import { readdir, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import type { CommandRoute } from "./types.js";

const VALID_EXTENSIONS = [".ts", ".js", ".mjs", ".cjs"];
const COMMAND_FILENAME = "+command";

/**
 * Check if a file is a valid command file (+command.ts, +command.js, etc.)
 */
function isCommandFile(filename: string): boolean {
  const nameWithoutExt = basename(filename, extname(filename));
  if (nameWithoutExt !== COMMAND_FILENAME) return false;
  const ext = extname(filename);
  return VALID_EXTENSIONS.includes(ext);
}

/**
 * Extract parameter name from bracket notation [param]
 */
function extractParamName(name: string): string | null {
  const match = name.match(/^\[([^\]]+)\]$/);
  return match ? match[1] : null;
}

/**
 * Recursively scan directory for command folders containing +command.ts
 */
async function scanDir(
  dir: string,
  baseDir: string,
  currentSegments: string[] = [],
): Promise<CommandRoute[]> {
  const routes: CommandRoute[] = [];

  const entries = await readdir(dir, { withFileTypes: true });

  // First, check if there's a +command.ts file in the current directory
  const commandFile = entries.find(
    (entry) => entry.isFile() && isCommandFile(entry.name),
  );

  if (commandFile) {
    // This directory contains a command
    const fullPath = join(dir, commandFile.name);

    // Determine which segments are dynamic parameters
    const params: string[] = [];

    // Check each segment for dynamic params (e.g., [id])
    for (const segment of currentSegments) {
      const paramName = extractParamName(segment);
      if (paramName) {
        params.push(paramName);
      }
    }

    // Handle special case: commands/+command.ts maps to root command (index)
    // and commands/index/+command.ts also maps to root
    const segments =
      currentSegments.length === 0 ||
      (currentSegments.length === 1 && currentSegments[0] === "index")
        ? ["index"]
        : currentSegments[0] === "index"
          ? currentSegments.slice(1)
          : currentSegments;

    routes.push({
      filePath: fullPath,
      segments,
      params,
      isDynamic: params.length > 0,
    });
  }

  // Then recurse into subdirectories
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const segment = entry.name;
      const subRoutes = await scanDir(
        join(dir, entry.name),
        baseDir,
        [...currentSegments, segment],
      );
      routes.push(...subRoutes);
    }
  }

  return routes;
}

/**
 * Scan the commands directory and return all discovered routes
 */
export async function scanCommands(commandsDir: string): Promise<CommandRoute[]> {
  try {
    const stats = await stat(commandsDir);
    if (!stats.isDirectory()) {
      throw new Error(`Commands path is not a directory: ${commandsDir}`);
    }

    const routes = await scanDir(commandsDir, commandsDir);
    return sortRoutes(routes);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Commands directory not found: ${commandsDir}`);
    }
    throw error;
  }
}

/**
 * Sort routes by specificity:
 * 1. Static routes before dynamic routes
 * 2. Among static routes: more segments first (deeper paths)
 * 3. Among dynamic routes: fewer params first, then more segments
 */
export function sortRoutes(routes: CommandRoute[]): CommandRoute[] {
  return [...routes].sort((a, b) => {
    // Static routes come before dynamic routes
    if (!a.isDynamic && b.isDynamic) return -1;
    if (a.isDynamic && !b.isDynamic) return 1;

    // Among dynamic routes, fewer params = more specific
    if (a.isDynamic && b.isDynamic) {
      if (a.params.length !== b.params.length) {
        return a.params.length - b.params.length;
      }
    }

    // Among same type, more segments first (deeper paths)
    return b.segments.length - a.segments.length;
  });
}
