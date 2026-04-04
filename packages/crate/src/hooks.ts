import type { Hooks, Context, CommandRoute } from "./types.js";

/**
 * Run beforeMatch hooks from both CLI and command levels.
 * CLI hooks run first (outer), then command hooks.
 * Returns potentially modified argv.
 */
export async function runBeforeMatch(
  cliHooks: Hooks | undefined,
  commandHooks: Hooks | undefined,
  argv: string[]
): Promise<string[]> {
  let currentArgv = argv;

  // CLI-level hook runs first (outer)
  if (cliHooks?.beforeMatch) {
    const result = await cliHooks.beforeMatch({ argv: currentArgv });
    if (result?.argv) {
      currentArgv = result.argv;
    }
  }

  // Command-level hook runs second (inner)
  if (commandHooks?.beforeMatch) {
    const result = await commandHooks.beforeMatch({ argv: currentArgv });
    if (result?.argv) {
      currentArgv = result.argv;
    }
  }

  return currentArgv;
}

/**
 * Run beforeLoad hooks from both CLI and command levels.
 * CLI hooks run first (outer), then command hooks.
 */
export async function runBeforeLoad(
  cliHooks: Hooks | undefined,
  commandHooks: Hooks | undefined,
  route: CommandRoute,
  argv: string[]
): Promise<void> {
  // CLI-level hook runs first (outer)
  if (cliHooks?.beforeLoad) {
    await cliHooks.beforeLoad({ route, argv });
  }

  // Command-level hook runs second (inner)
  if (commandHooks?.beforeLoad) {
    await commandHooks.beforeLoad({ route, argv });
  }
}

/**
 * Run beforeRun hooks from both CLI and command levels.
 * CLI hooks run first (outer), then command hooks.
 * Each hook can modify the context by returning a new Context object.
 */
export async function runBeforeRun(
  cliHooks: Hooks | undefined,
  commandHooks: Hooks | undefined,
  ctx: Context
): Promise<Context> {
  let currentCtx = ctx;

  // CLI-level hook runs first (outer)
  if (cliHooks?.beforeRun) {
    const result = await cliHooks.beforeRun(currentCtx);
    if (result) {
      currentCtx = result;
    }
  }

  // Command-level hook runs second (inner)
  if (commandHooks?.beforeRun) {
    const result = await commandHooks.beforeRun(currentCtx);
    if (result) {
      currentCtx = result;
    }
  }

  return currentCtx;
}

/**
 * Run afterRun hooks from both CLI and command levels.
 * Command hooks run first (bubble up), then CLI hooks.
 */
export async function runAfterRun(
  cliHooks: Hooks | undefined,
  commandHooks: Hooks | undefined,
  ctx: Context
): Promise<void> {
  // Command-level hook runs first (bubble up from inside)
  if (commandHooks?.afterRun) {
    await commandHooks.afterRun(ctx);
  }

  // CLI-level hook runs second (outer)
  if (cliHooks?.afterRun) {
    await cliHooks.afterRun(ctx);
  }
}

/**
 * Run onError hooks from both CLI and command levels.
 * Command hooks run first (bubble up), then CLI hooks.
 * If any hook returns true, the error is considered "handled" (swallowed).
 * Returns true if error was swallowed, false otherwise.
 */
export async function runOnError(
  cliHooks: Hooks | undefined,
  commandHooks: Hooks | undefined,
  error: unknown,
  ctx: Partial<Context>
): Promise<boolean> {
  // Command-level hook runs first (bubble up from inside)
  if (commandHooks?.onError) {
    const result = await commandHooks.onError(error, ctx);
    if (result === true) {
      return true; // Error was swallowed by command hook
    }
  }

  // CLI-level hook runs second (outer)
  if (cliHooks?.onError) {
    const result = await cliHooks.onError(error, ctx);
    if (result === true) {
      return true; // Error was swallowed by CLI hook
    }
  }

  return false; // Error was not swallowed
}
