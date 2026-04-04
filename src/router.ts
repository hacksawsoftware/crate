import type { CommandRoute } from "./types.js";

export interface RouteMatch {
  /** The matched route */
  route: CommandRoute;
  /** Dynamic path parameters (e.g., { target: "production" }) */
  params: Record<string, string>;
  /** Remaining arguments after the command path (to be parsed by the command) */
  remainingArgs: string[];
}

/**
 * Try to match argv against a specific route
 */
function tryMatchRoute(
  route: CommandRoute,
  argv: string[]
): { matches: boolean; params: Record<string, string>; remainingArgs: string[] } {
  const params: Record<string, string> = {};
  
  for (let i = 0; i < route.segments.length; i++) {
    const routeSeg = route.segments[i];
    const arg = argv[i];
    
    if (arg === undefined) {
      // Not enough arguments
      return { matches: false, params: {}, remainingArgs: [] };
    }
    
    const isDynamic = routeSeg.startsWith("[") && routeSeg.endsWith("]");
    
    if (isDynamic) {
      // Extract param name from [param]
      const paramName = routeSeg.slice(1, -1);
      params[paramName] = arg;
    } else if (routeSeg !== arg) {
      // Static segment doesn't match
      return { matches: false, params: {}, remainingArgs: [] };
    }
  }
  
  // Success - return remaining args (everything after the matched path)
  const remainingArgs = argv.slice(route.segments.length);
  return { matches: true, params, remainingArgs };
}

/**
 * Match argv against available routes
 * Returns the best match based on specificity
 */
export function matchRoute(
  routes: CommandRoute[],
  argv: string[]
): RouteMatch | null {
  // Try routes in order (already sorted by specificity)
  for (const route of routes) {
    const result = tryMatchRoute(route, argv);
    
    if (result.matches) {
      return {
        route,
        params: result.params,
        remainingArgs: result.remainingArgs,
      };
    }
  }
  
  return null;
}

/**
 * Find the root command (index.ts) from routes
 */
export function findRootCommand(routes: CommandRoute[]): CommandRoute | null {
  return routes.find(r => 
    r.segments.length === 1 && r.segments[0] === "index"
  ) || null;
}
