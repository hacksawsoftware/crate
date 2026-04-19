import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ValidationError, validateWithSchema, extractSchemaFlags, getSchemaVendor } from '../schema';

describe('Validation', () => {
  describe('ValidationError', () => {
    it('should create validation error with formatted message', () => {
      const issues: any[] = [
        {
          path: ['name'],
          message: 'Required',
        },
      ];

      const error = new ValidationError(issues, 'flags', 'deploy');
      expect(error.name).toBe('ValidationError');
      expect(error.context).toBe('flags');
      expect(error.issues).toBe(issues);
      expect(error.message).toContain('Validation failed');
    });

    it('should format args validation errors', () => {
      const issues: any[] = [
        {
          path: ['0'],
          message: 'Expected string',
        },
      ];

      const error = new ValidationError(issues, 'args');
      expect(error.message).toContain('args');
    });
  });

  describe('validateWithSchema', () => {
    it('should validate correct data', async () => {
      const schema = z.object({
        name: z.string(),
        count: z.number(),
      });

      const data = { name: 'test', count: 42 };
      const result = await validateWithSchema(schema, data, 'flags');

      expect(result).toEqual(data);
    });

    it('should throw ValidationError on invalid data', async () => {
      const schema = z.object({
        name: z.string(),
      });

      try {
        await validateWithSchema(schema, { name: 123 }, 'flags');
        expect.fail('Should have thrown ValidationError');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
      }
    });

    it('should throw ValidationError on missing required field', async () => {
      const schema = z.object({
        name: z.string(),
      });

      try {
        await validateWithSchema(schema, {}, 'flags');
        expect.fail('Should have thrown ValidationError');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        if (e instanceof ValidationError) {
          expect(e.context).toBe('flags');
        }
      }
    });

    it('should handle array validation', async () => {
      const schema = z.tuple([z.string(), z.number()]);

      const result = await validateWithSchema(schema, ['test', 42], 'args');
      expect(result).toEqual(['test', 42]);
    });
  });

  describe('extractSchemaFlags', () => {
    it('should extract flags from Zod schema with JSON Schema', () => {
      const schema = z.object({
        force: z.boolean().default(false),
        name: z.string(),
        tags: z.array(z.string()).default([]),
      });

      const result = extractSchemaFlags(schema);

      expect(result.success).toBe(true);
      expect(result.config.boolean).toContain('force');
      expect(result.config.string).toContain('name');
      expect(result.config.array).toContain('tags');
      expect(result.config.defaults.force).toBe(false);
      expect(result.config.defaults.tags).toEqual([]);
    });

    it('should handle optional fields', () => {
      const schema = z.object({
        force: z.boolean().optional(),
        name: z.string(),
      });

      const result = extractSchemaFlags(schema);

      expect(result.success).toBe(true);
      expect(result.config.string).toContain('name');
    });

    it('should use explicit config as fallback', () => {
      const schema = z.object({
        force: z.boolean(),
        count: z.string(),
      });

      const explicitConfig = {
        boolean: ['force'],
        string: ['count'],
        defaults: { force: false },
      };

      // Even if JSON Schema extraction works, we can pass explicit config
      const result = extractSchemaFlags(schema, explicitConfig);
      expect(result.success).toBe(true);
    });

    it('should extract defaults from schema', () => {
      const schema = z.object({
        timeout: z.number().default(30),
        retries: z.number().default(3),
      });

      const result = extractSchemaFlags(schema);

      expect(result.success).toBe(true);
      expect(result.config.defaults.timeout).toBe(30);
      expect(result.config.defaults.retries).toBe(3);
    });

    it('should handle union types', () => {
      const schema = z.object({
        value: z.union([z.string(), z.number()]),
      });

      const result = extractSchemaFlags(schema);

      expect(result.success).toBe(true);
      // Union of string and number should be treated as string for CLI
      expect(result.config.string).toContain('value');
    });

    it('should detect arrays from schema', () => {
      const schema = z.object({
        files: z.array(z.string()),
        names: z.array(z.string()).default([]),
      });

      const result = extractSchemaFlags(schema);

      expect(result.success).toBe(true);
      expect(result.config.array).toContain('files');
      expect(result.config.array).toContain('names');
    });

    it('should return empty config for non-schema objects', () => {
      const result = extractSchemaFlags({ random: 'object' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle null/undefined schema', () => {
      const result = extractSchemaFlags(null);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getSchemaVendor', () => {
    it('should extract vendor from Zod schema', () => {
      const schema = z.object({ name: z.string() });
      const vendor = getSchemaVendor(schema);

      expect(vendor).toBe('zod');
    });

    it('should return null for non-schema objects', () => {
      const vendor = getSchemaVendor({ random: 'object' });
      expect(vendor).toBeNull();
    });

    it('should return null for null/undefined', () => {
      expect(getSchemaVendor(null)).toBeNull();
      expect(getSchemaVendor(undefined)).toBeNull();
    });
  });
});
