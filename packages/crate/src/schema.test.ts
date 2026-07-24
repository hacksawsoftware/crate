import { describe, it, expect } from "vitest";
import { extractSchemaFlags, getSchemaVendor } from "./schema.js";
import { z } from "zod";

function createValibotLikeSchema(vendor: string) {
  return {
    "~standard": {
      vendor,
      version: 1,
      validate: () => ({ value: {} }),
    },
  };
}

describe("extractSchemaFlags with toJSONSchema", () => {
  it("uses command-level toJSONSchema when schema object has no native export", () => {
    const flagsSchema = createValibotLikeSchema("valibot");

    const toJSONSchema = () => ({
      type: "object",
      properties: {
        force: { type: "boolean", default: false },
        region: { type: "string" },
        tags: { type: "array", items: { type: "string" }, default: [] },
      },
    });

    const result = extractSchemaFlags(flagsSchema, undefined, toJSONSchema);

    expect(result.success).toBe(true);
    expect(result.config.boolean).toEqual(["force"]);
    expect(result.config.string).toEqual(["region"]);
    expect(result.config.array).toEqual(["tags"]);
    expect(result.config.defaults).toEqual({ force: false, tags: [] });
  });

  it("prefers toJSONSchema over schema object methods when both present", () => {
    const flagsSchema = {
      toJSONSchema() {
        return {
          type: "object",
          properties: {
            verbose: { type: "boolean", default: false },
          },
        };
      },
    };

    const toJSONSchema = () => ({
      type: "object",
      properties: {
        debug: { type: "boolean", default: true },
      },
    });

    const result = extractSchemaFlags(flagsSchema, undefined, toJSONSchema);

    expect(result.success).toBe(true);
    expect(result.config.boolean).toEqual(["debug"]);
  });

  it("falls back to schema object methods when toJSONSchema fails", () => {
    const flagsSchema = {
      toJSONSchema() {
        return {
          type: "object",
          properties: {
            verbose: { type: "boolean", default: false },
          },
        };
      },
    };

    const toJSONSchema = () => {
      throw new Error("boom");
    };

    const result = extractSchemaFlags(flagsSchema, undefined, toJSONSchema);

    expect(result.success).toBe(true);
    expect(result.config.boolean).toEqual(["verbose"]);
  });

  it("auto-detects boolean defaults for valibot via toJSONSchema", () => {
    const flagsSchema = createValibotLikeSchema("valibot");

    const toJSONSchema = () => ({
      type: "object",
      properties: {
        dryRun: { type: "boolean" },
      },
    });

    const result = extractSchemaFlags(flagsSchema, undefined, toJSONSchema);

    expect(result.success).toBe(true);
    expect(result.config.boolean).toEqual(["dryRun"]);
    expect(result.config.defaults).toEqual({ dryRun: false });
  });
});

describe("extractSchemaFlags with empty or absent schemas", () => {
  it("returns success when schema is undefined", () => {
    const result = extractSchemaFlags(undefined);
    expect(result.success).toBe(true);
    expect(result.config.boolean).toEqual([]);
    expect(result.config.string).toEqual([]);
    expect(result.config.array).toEqual([]);
    expect(result.config.defaults).toEqual({});
  });

  it("returns success when schema is null", () => {
    const result = extractSchemaFlags(null);
    expect(result.success).toBe(true);
  });

  it("returns success for empty explicit argTypes", () => {
    const result = extractSchemaFlags(createValibotLikeSchema("valibot"), {
      boolean: [],
      string: [],
      array: [],
    });
    expect(result.success).toBe(true);
    expect(result.config.boolean).toEqual([]);
    expect(result.config.string).toEqual([]);
    expect(result.config.array).toEqual([]);
  });

  it("returns success for empty JSON Schema via toJSONSchema", () => {
    const flagsSchema = createValibotLikeSchema("valibot");

    const toJSONSchema = () => ({
      type: "object",
    });

    const result = extractSchemaFlags(flagsSchema, undefined, toJSONSchema);
    expect(result.success).toBe(true);
    expect(result.config.boolean).toEqual([]);
    expect(result.config.string).toEqual([]);
    expect(result.config.array).toEqual([]);
    expect(result.config.defaults).toEqual({});
  });

  it("returns success for Zod v4 empty object schema", () => {
    const flagsSchema = z.object({});
    const result = extractSchemaFlags(flagsSchema);
    expect(result.success).toBe(true);
    expect(result.config.boolean).toEqual([]);
    expect(result.config.string).toEqual([]);
    expect(result.config.array).toEqual([]);
    expect(result.config.defaults).toEqual({});
  });
});

describe("extractSchemaFlags Zod v4 regression", () => {
  it("auto-detects boolean, string, and array flags from Zod schema", () => {
    const flagsSchema = z.object({
      force: z.boolean().default(false),
      region: z.string(),
      tags: z.array(z.string()).default([]),
    });

    const result = extractSchemaFlags(flagsSchema);

    expect(result.success).toBe(true);
    expect(result.config.boolean).toEqual(["force"]);
    expect(result.config.string).toEqual(["region"]);
    expect(result.config.array).toEqual(["tags"]);
    expect(result.config.defaults).toEqual({ force: false, tags: [] });
  });

  it("auto-detects number flags as strings for CLI parsing", () => {
    const flagsSchema = z.object({
      count: z.number().default(1),
    });

    const result = extractSchemaFlags(flagsSchema);

    expect(result.success).toBe(true);
    expect(result.config.string).toEqual(["count"]);
    expect(result.config.defaults).toEqual({ count: 1 });
  });
});

describe("extractSchemaFlags ArkType regression", () => {
  it("auto-detects flags from schema with toJsonSchema method", () => {
    const flagsSchema = {
      toJsonSchema() {
        return {
          type: "object",
          properties: {
            verbose: { type: "boolean", default: false },
            name: { type: "string" },
            tags: { type: "array", items: { type: "string" }, default: [] },
          },
        };
      },
    };

    const result = extractSchemaFlags(flagsSchema);

    expect(result.success).toBe(true);
    expect(result.config.boolean).toEqual(["verbose"]);
    expect(result.config.string).toEqual(["name"]);
    expect(result.config.array).toEqual(["tags"]);
    expect(result.config.defaults).toEqual({ verbose: false, tags: [] });
  });
});

describe("extractSchemaFlags explicit argTypes regression", () => {
  it("uses explicit argTypes when JSON Schema extraction unavailable", () => {
    const flagsSchema = createValibotLikeSchema("valibot");

    const result = extractSchemaFlags(flagsSchema, {
      boolean: ["force"],
      string: ["region"],
      array: ["tags"],
      defaults: { force: false, tags: [] },
    });

    expect(result.success).toBe(true);
    expect(result.config.boolean).toEqual(["force"]);
    expect(result.config.string).toEqual(["region"]);
    expect(result.config.array).toEqual(["tags"]);
    expect(result.config.defaults).toEqual({ force: false, tags: [] });
  });
});

describe("extractSchemaFlags warning cases", () => {
  it("returns failure when schema has properties but no extraction method and no argTypes", () => {
    const flagsSchema = createValibotLikeSchema("valibot");

    const result = extractSchemaFlags(flagsSchema);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Could not extract flag configuration");
  });

  it("returns failure for an opaque schema without toJSONSchema or argTypes", () => {
    const flagsSchema = { someInternalField: true };

    const result = extractSchemaFlags(flagsSchema);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("getSchemaVendor", () => {
  it("returns the vendor from a Standard Schema", () => {
    const schema = createValibotLikeSchema("valibot");
    expect(getSchemaVendor(schema)).toBe("valibot");
  });

  it("returns null for non-objects", () => {
    expect(getSchemaVendor(null)).toBe(null);
    expect(getSchemaVendor(undefined)).toBe(null);
    expect(getSchemaVendor("string")).toBe(null);
  });
});
