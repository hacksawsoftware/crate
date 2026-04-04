import { readdir, stat } from "node:fs/promises";
import { join, relative, extname, basename } from "node:path";
import type { CommandRoute } from "./types.js";

const VALID_EXTENSIONS = [".ts", ".js", ".mjs", ".cjs"];

/**
 * Check if a file is a valid command file
 */
function isCommandFile(filename: string): boolean {
  const ext = extname(filename);
  return VALID_EXTENSIONS.includes(ext);
}

/**
 * Extract parameter name from bracket notation [param].ts
 */
function extractParamName(name: string): string | null {
  const nameWithoutExt = extname(name) ? basename(name, extname(name)) : name;
  const match = nameWithoutExt.match(/^\[([^\]]+)\]$/);
  return match ? match[1] : null;
}

/**
 * Convert a filename to a segment name (removes extension, preserves param brackets)
 */
function filenameToSegment(filename: string): string {
  const nameWithoutExt = basename(filename, extname(filename));
  return nameWithoutExt;
}

/**
 * Recursively scan directory for command files
 */
async function scanDir(
  dir: string,
  baseDir: string,
  currentSegments: string[] = []
): Promise<CommandRoute[]> {
  const routes: CommandRoute[] = [];
  
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Recurse into subdirectory
      const segment = filenameToSegment(entry.name);
      const subRoutes = await scanDir(fullPath, baseDir, [...currentSegments, segment]);
      routes.push(...subRoutes);
    } else if (entry.isFile() && isCommandFile(entry.name)) {
      // Process command file
      const segment = filenameToSegment(entry.name);
      const segments = [...currentSegments, segment];
      
      // Determine which segments are dynamic parameters
      const params: string[] = [];
      const pathSegments = relative(baseDir, dir).split("/").filter(Boolean);
      
      // Check each directory in the path for dynamic params
      for (const pathSeg of pathSegments) {
        const paramName = extractParamName(pathSeg);
        if (paramName) {
          params.push(paramName);
        }
      }
      
      // Check if the file itself is a dynamic param
      const fileParam = extractParamName(entry.name);
      if (fileParam) {
        params.push(fileParam);
      }
      
      routes.push({
        filePath: fullPath,
        segments,
        params,
        isDynamic: params.length > 0,
      });
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
