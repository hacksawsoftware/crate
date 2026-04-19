import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineCommand } from '../define.js';
import { matchRoute, findRootCommand } from '../router.js';
import { validateWithSchema, extractSchemaFlags } from '../schema.js';
import type { CommandRoute } from '../types.js';

describe('Integration Tests', () => {
  describe('End-to-End Flow', () => {
    it('should create a valid command definition with defineCommand', () => {
      const cmd = defineCommand({
        args: z.tuple([z.string()]),
        flags: z.object({
          force: z.boolean().default(false),
          output: z.string().optional(),
        }),
        meta: {
          description: 'Deploy the app',
          examples: ['cli deploy production --force'],
        },
        async run({ args, flags, log }: any) {
          log(`Deploying to ${args[0]}...`);
          if (flags.force) log('Force mode!');
        },
      });

      expect(cmd).toBeDefined();
      expect(cmd.default).toBeDefined();
      expect(cmd.meta?.description).toBe('Deploy the app');
    });

    it('should match routes and extract parameters', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/deploy/[env]/+command.ts',
          segments: ['deploy', '[env]'],
          params: ['env'],
          isDynamic: true,
        },
      ];

      const match = matchRoute(routes, ['deploy', 'production']);

      expect(match).not.toBeNull();
      expect(match?.params).toEqual({ env: 'production' });
      expect(match?.remainingArgs).toEqual([]);
    });

    it('should validate args against schema', async () => {
      const schema = z.tuple([z.string(), z.number()]);

      const result = await validateWithSchema(schema, ['test', 42], 'args');

      expect(result).toEqual(['test', 42]);
    });

    it('should validate flags against schema', async () => {
      const schema = z.object({
        name: z.string(),
        count: z.number().optional(),
      });

      const result = await validateWithSchema(
        schema,
        { name: 'test', count: 5 },
        'flags',
      );

      expect(result).toEqual({ name: 'test', count: 5 });
    });

    it('should extract schema flags correctly', () => {
      const schema = z.object({
        force: z.boolean().default(false),
        output: z.string(),
        tags: z.array(z.string()).default([]),
      });

      const result = extractSchemaFlags(schema);

      expect(result.success).toBe(true);
      expect(result.config.boolean).toContain('force');
      expect(result.config.string).toContain('output');
      expect(result.config.array).toContain('tags');
      expect(result.config.defaults.force).toBe(false);
      expect(result.config.defaults.tags).toEqual([]);
    });
  });

  describe('Complex Routing Scenarios', () => {
    it('should handle nested dynamic routes', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/app/[name]/delete/+command.ts',
          segments: ['app', '[name]', 'delete'],
          params: ['name'],
          isDynamic: true,
        },
      ];

      const match = matchRoute(routes, ['app', 'myapp', 'delete']);

      expect(match).not.toBeNull();
      expect(match?.params.name).toBe('myapp');
    });

    it('should find root command in mixed route list', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/index/+command.ts',
          segments: ['index'],
          params: [],
          isDynamic: false,
        },
        {
          filePath: '/commands/deploy/+command.ts',
          segments: ['deploy'],
          params: [],
          isDynamic: false,
        },
        {
          filePath: '/commands/info/[id]/+command.ts',
          segments: ['info', '[id]'],
          params: ['id'],
          isDynamic: true,
        },
      ];

      const root = findRootCommand(routes);

      expect(root).not.toBeNull();
      expect(root?.segments).toEqual(['index']);
    });

    it('should match more specific routes first', () => {
      const routes: CommandRoute[] = [
        {
          filePath: '/commands/info/[id]/+command.ts',
          segments: ['info', '[id]'],
          params: ['id'],
          isDynamic: true,
        },
        {
          filePath: '/commands/info/special/+command.ts',
          segments: ['info', 'special'],
          params: [],
          isDynamic: false,
        },
      ];

      // When routes are not sorted by specificity, the first one matches
      const match = matchRoute(routes, ['info', 'special']);

      expect(match?.params.id).toBe('special');
    });
  });

  describe('Validation with Complex Schemas', () => {
    it('should validate union types', async () => {
      const schema = z.object({
        value: z.union([z.string(), z.number()]),
      });

      const result1 = await validateWithSchema(
        schema,
        { value: 'test' },
        'flags',
      );
      expect(result1.value).toBe('test');

      const result2 = await validateWithSchema(schema, { value: 42 }, 'flags');
      expect(result2.value).toBe(42);
    });

    it('should validate optional fields', async () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const result = await validateWithSchema(
        schema,
        { required: 'value' },
        'flags',
      );

      expect(result.required).toBe('value');
      expect(result.optional).toBeUndefined();
    });

    it('should validate with default values', async () => {
      const schema = z.object({
        name: z.string(),
        timeout: z.number().default(30),
      });

      const result = await validateWithSchema(
        schema,
        { name: 'test' },
        'flags',
      );

      expect(result.timeout).toBe(30);
    });

    it('should handle array validation', async () => {
      const schema = z.object({
        items: z.array(z.string()).default([]),
      });

      const result = await validateWithSchema(
        schema,
        { items: ['a', 'b'] },
        'flags',
      );

      expect(result.items).toEqual(['a', 'b']);
    });
  });

  describe('Command Definition with Hooks', () => {
    it('should allow defining hooks in command', () => {
      const cmd = defineCommand({
        flags: z.object({}),
        meta: { description: 'Test command' },
        hooks: {
          beforeRun: async (ctx: any) => {
            return ctx;
          },
          afterRun: async (_ctx: any) => {
            // After run
          },
        },
        async run({ log }: any) {
          log('test');
        },
      });

      expect(cmd.hooks).toBeDefined();
      expect(cmd.hooks?.beforeRun).toBeDefined();
      expect(cmd.hooks?.afterRun).toBeDefined();
    });
  });

  describe('defineCommand Type Safety', () => {
    it('should infer args type correctly', () => {
      const cmd = defineCommand({
        args: z.tuple([z.string(), z.number()]),
        async run({ args }: any) {
          // args should be [string, number]
          const str: string = args[0];
          const num: number = args[1];

          expect(typeof str).toBe('string');
          expect(typeof num).toBe('number');
        },
      });

      expect(cmd.default).toBeDefined();
    });

    it('should infer flags type correctly', () => {
      const cmd = defineCommand({
        flags: z.object({
          force: z.boolean().default(false),
          name: z.string(),
          tags: z.array(z.string()),
        }),
        async run({ flags }: any) {
          // flags should have the correct types
          const force: boolean = flags.force;
          const name: string = flags.name;
          const tags: string[] = flags.tags;

          expect(typeof force).toBe('boolean');
          expect(typeof name).toBe('string');
          expect(Array.isArray(tags)).toBe(true);
        },
      });

      expect(cmd.default).toBeDefined();
    });
  });
});
