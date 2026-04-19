import { describe, it, expect } from 'vitest';
import {
  runBeforeMatch,
  runBeforeLoad,
  runBeforeRun,
  runAfterRun,
  runOnError,
} from '../hooks.js';
import type { Hooks, Context, CommandRoute } from '../types.js';

describe('Hooks', () => {
  describe('runBeforeMatch', () => {
    it('should run CLI hook first', async () => {
      const callOrder: string[] = [];

      const cliHooks: Hooks = {
        beforeMatch: ({ argv }: any) => {
          callOrder.push('cli');
          return { argv };
        },
      };

      const commandHooks: Hooks = {
        beforeMatch: ({ argv }: any) => {
          callOrder.push('command');
          return { argv };
        },
      };

      await runBeforeMatch(cliHooks, commandHooks, ['test']);

      expect(callOrder).toEqual(['cli', 'command']);
    });

    it('should allow modifying argv', async () => {
      const cliHooks: Hooks = {
        beforeMatch: ({ argv }: any) => {
          return { argv: [...argv, 'added'] };
        },
      };

      const result = await runBeforeMatch(cliHooks, undefined, ['test']);

      expect(result).toEqual(['test', 'added']);
    });

    it('should pass modified argv to next hook', async () => {
      const cliHooks: Hooks = {
        beforeMatch: ({ argv }: any) => {
          return { argv: [...argv, 'first'] };
        },
      };

      const commandHooks: Hooks = {
        beforeMatch: ({ argv }: any) => {
          return { argv: [...argv, 'second'] };
        },
      };

      const result = await runBeforeMatch(cliHooks, commandHooks, ['test']);

      expect(result).toEqual(['test', 'first', 'second']);
    });

    it('should handle undefined hooks', async () => {
      const result = await runBeforeMatch(undefined, undefined, ['test']);

      expect(result).toEqual(['test']);
    });

    it('should handle hooks that dont return anything', async () => {
      const cliHooks: Hooks = {
        beforeMatch: () => {
          // No return
        },
      };

      const result = await runBeforeMatch(cliHooks, undefined, ['test']);

      expect(result).toEqual(['test']);
    });
  });

  describe('runBeforeLoad', () => {
    it('should run CLI hook before command hook', async () => {
      const callOrder: string[] = [];

      const cliHooks: Hooks = {
        beforeLoad: () => {
          callOrder.push('cli');
        },
      };

      const commandHooks: Hooks = {
        beforeLoad: () => {
          callOrder.push('command');
        },
      };

      const route: CommandRoute = {
        filePath: '/commands/deploy/+command.ts',
        segments: ['deploy'],
        params: [],
        isDynamic: false,
      };

      await runBeforeLoad(cliHooks, commandHooks, route, ['deploy']);

      expect(callOrder).toEqual(['cli', 'command']);
    });

    it('should pass route and argv to hooks', async () => {
      const receivedArgs: any[] = [];

      const cliHooks: Hooks = {
        beforeLoad: (ctx: any) => {
          receivedArgs.push(ctx);
        },
      };

      const route: CommandRoute = {
        filePath: '/commands/deploy/+command.ts',
        segments: ['deploy'],
        params: [],
        isDynamic: false,
      };

      await runBeforeLoad(cliHooks, undefined, route, ['deploy']);

      expect(receivedArgs[0]).toHaveProperty('route');
      expect(receivedArgs[0]).toHaveProperty('argv');
      expect(receivedArgs[0].route).toBe(route);
    });
  });

  describe('runBeforeRun', () => {
    it('should run CLI hook before command hook', async () => {
      const callOrder: string[] = [];

      const cliHooks: Hooks = {
        beforeRun: (ctx: any) => {
          callOrder.push('cli');
          return ctx;
        },
      };

      const commandHooks: Hooks = {
        beforeRun: (ctx: any) => {
          callOrder.push('command');
          return ctx;
        },
      };

      const ctx: Context = {
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
        args: [],
        flags: {},
        rawArgv: [],
        log: () => {},
        error: () => {},
      };

      await runBeforeRun(cliHooks, commandHooks, ctx);

      expect(callOrder).toEqual(['cli', 'command']);
    });

    it('should allow modifying context', async () => {
      const cliHooks: Hooks = {
        beforeRun: (ctx: any) => {
          return {
            ...ctx,
            flags: { ...ctx.flags, modified: true },
          };
        },
      };

      const ctx: Context = {
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
        args: [],
        flags: {},
        rawArgv: [],
        log: () => {},
        error: () => {},
      };

      const result = await runBeforeRun(cliHooks, undefined, ctx);

      expect((result.flags as any).modified).toBe(true);
    });

    it('should pass modified context to next hook', async () => {
      const cliHooks: Hooks = {
        beforeRun: (ctx: any) => {
          return {
            ...ctx,
            flags: { ...ctx.flags, from: 'cli' },
          };
        },
      };

      const commandHooks: Hooks = {
        beforeRun: (ctx: any) => {
          return {
            ...ctx,
            flags: { ...ctx.flags, from: 'command' },
          };
        },
      };

      const ctx: Context = {
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
        args: [],
        flags: {},
        rawArgv: [],
        log: () => {},
        error: () => {},
      };

      const result = await runBeforeRun(cliHooks, commandHooks, ctx);

      expect((result.flags as any).from).toBe('command');
    });
  });

  describe('runAfterRun', () => {
    it('should run command hook before CLI hook (bubble up)', async () => {
      const callOrder: string[] = [];

      const cliHooks: Hooks = {
        afterRun: () => {
          callOrder.push('cli');
        },
      };

      const commandHooks: Hooks = {
        afterRun: () => {
          callOrder.push('command');
        },
      };

      const ctx: Context = {
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
        args: [],
        flags: {},
        rawArgv: [],
        log: () => {},
        error: () => {},
      };

      await runAfterRun(cliHooks, commandHooks, ctx);

      expect(callOrder).toEqual(['command', 'cli']);
    });
  });

  describe('runOnError', () => {
    it('should run command hook before CLI hook (bubble up)', async () => {
      const callOrder: string[] = [];

      const cliHooks: Hooks = {
        onError: () => {
          callOrder.push('cli');
          return false;
        },
      };

      const commandHooks: Hooks = {
        onError: () => {
          callOrder.push('command');
          return false;
        },
      };

      await runOnError(cliHooks, commandHooks, new Error('test'), {});

      expect(callOrder).toEqual(['command', 'cli']);
    });

    it('should return true if command hook swallows error', async () => {
      const commandHooks: Hooks = {
        onError: () => true,
      };

      const result = await runOnError(undefined, commandHooks, new Error('test'), {});

      expect(result).toBe(true);
    });

    it('should return true if CLI hook swallows error', async () => {
      const cliHooks: Hooks = {
        onError: () => true,
      };

      const result = await runOnError(cliHooks, undefined, new Error('test'), {});

      expect(result).toBe(true);
    });

    it('should return false if no hook swallows error', async () => {
      const cliHooks: Hooks = {
        onError: () => false,
      };

      const commandHooks: Hooks = {
        onError: () => false,
      };

      const result = await runOnError(cliHooks, commandHooks, new Error('test'), {});

      expect(result).toBe(false);
    });

    it('should short-circuit on first true result', async () => {
      const callOrder: string[] = [];

      const cliHooks: Hooks = {
        onError: () => {
          callOrder.push('cli');
          return true;
        },
      };

      const commandHooks: Hooks = {
        onError: () => {
          callOrder.push('command');
          return true;
        },
      };

      const result = await runOnError(cliHooks, commandHooks, new Error('test'), {});

      expect(result).toBe(true);
      expect(callOrder).toContain('command');
    });

    it('should pass error and context to hooks', async () => {
      const receivedErrors: any[] = [];

      const cliHooks: Hooks = {
        onError: (error: any, ctx: any) => {
          receivedErrors.push({ error, ctx });
          return false;
        },
      };

      const error = new Error('test error');
      const partialCtx = { flags: { test: true } };

      await runOnError(cliHooks, undefined, error, partialCtx);

      expect(receivedErrors[0].error).toBe(error);
      expect(receivedErrors[0].ctx).toBe(partialCtx);
    });
  });
});
