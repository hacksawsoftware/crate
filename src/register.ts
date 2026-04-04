/**
 * TypeScript loader for .ts command files
 * 
 * Usage: node --import ./register.js cli.ts
 * 
 * This module enables TypeScript support for CLI development.
 * For production, it's recommended to compile to JavaScript first.
 */

// Check if Node has native TypeScript support
const hasNativeTs = (() => {
  try {
    const [major, minor] = process.version.slice(1).split(".").map(Number);
    return major > 22 || (major === 22 && minor >= 6);
  } catch {
    return false;
  }
})();

/**
 * Module loader hook for Node.js
 */
export async function resolve(
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (specifier: string, context: object) => Promise<{ url: string; shortCircuit?: boolean }>
): Promise<{ url: string; shortCircuit?: boolean; format?: string }> {
  // Handle .ts imports
  if (specifier.endsWith(".ts")) {
    const resolved = await nextResolve(specifier, context);
    return {
      ...resolved,
      format: "module",
    };
  }
  
  // Try .ts extension if .js is not found
  if (specifier.endsWith(".js")) {
    const tsSpecifier = specifier.slice(0, -3) + ".ts";
    try {
      const resolved = await nextResolve(tsSpecifier, context);
      return {
        ...resolved,
        format: "module",
      };
    } catch {
      // Fall through to normal resolution
    }
  }
  
  return nextResolve(specifier, context);
}

/**
 * Module loader for TypeScript files
 */
export async function load(
  url: string,
  context: { format?: string },
  nextLoad: (url: string, context: object) => Promise<{ source: string | Buffer; format: string; shortCircuit?: boolean }>
): Promise<{ source: string | Buffer; format: string; shortCircuit?: boolean }> {
  // Let native TypeScript handle it if available
  if (hasNativeTs) {
    return nextLoad(url, context);
  }
  
  // Otherwise, we need to provide instructions
  if (url.endsWith(".ts")) {
    throw new Error(
      `TypeScript support requires Node.js >= 22.6.0 or tsx.\n` +
      `Please either:\n` +
      `  1. Upgrade to Node.js 22.6.0+ (with --experimental-strip-types)\n` +
      `  2. Install tsx: npm install -D tsx\n` +
      `  3. Run with tsx: npx tsx ${process.argv[1]}\n` +
      `  4. Or compile to JavaScript first: npx tsc`
    );
  }
  
  return nextLoad(url, context);
}
