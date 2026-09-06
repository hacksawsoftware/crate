import { describe, it, expect, expectTypeOf } from "vitest";
import * as v from "valibot";
import { z } from "zod";
import { defineCommand, type InferOutput } from "./define.js";
import { extractSchemaFlags } from "./schema.js";

describe("defineCommand toJSONSchema integration", () => {
  it("preserves toJSONSchema on the returned command definition", () => {
    const toJSONSchema = () => ({
      type: "object",
      properties: {
        verbose: { type: "boolean", default: false },
      },
    });

    const command = defineCommand({
      flags: {
        "~standard": { vendor: "valibot", version: 1, validate: () => ({ value: {} }) },
      } as any,
      toJSONSchema,
      meta: { description: "Test" },
      async run() {},
    });

    expect(command.toJSONSchema).toBe(toJSONSchema);
  });

  it("extractSchemaFlags receives toJSONSchema from a defineCommand output", () => {
    const toJSONSchema = () => ({
      type: "object",
      properties: {
        force: { type: "boolean", default: false },
        region: { type: "string" },
      },
    });

    const command = defineCommand({
      flags: {
        "~standard": { vendor: "valibot", version: 1, validate: () => ({ value: {} }) },
      } as any,
      toJSONSchema,
      async run() {},
    });

    const result = extractSchemaFlags(
      command.flags,
      {
        boolean: command.argTypes?.boolean,
        string: command.argTypes?.string,
        array: command.argTypes?.array,
        defaults: command.defaults,
      },
      command.toJSONSchema,
    );

    expect(result.success).toBe(true);
    expect(result.config.boolean).toEqual(["force"]);
    expect(result.config.string).toEqual(["region"]);
  });

  it("silent for no flags schema via defineCommand", () => {
    const command = defineCommand({
      async run() {},
    });

    const result = extractSchemaFlags(
      command.flags,
      {
        boolean: command.argTypes?.boolean,
        string: command.argTypes?.string,
        array: command.argTypes?.array,
        defaults: command.defaults,
      },
      command.toJSONSchema,
    );

    expect(result.success).toBe(true);
  });

  it("silent for empty explicit argTypes via defineCommand", () => {
    const command = defineCommand({
      flags: {
        "~standard": { vendor: "valibot", version: 1, validate: () => ({ value: {} }) },
      } as any,
      argTypes: { boolean: [], string: [], array: [] },
      async run() {},
    });

    const result = extractSchemaFlags(
      command.flags,
      {
        boolean: command.argTypes?.boolean,
        string: command.argTypes?.string,
        array: command.argTypes?.array,
        defaults: command.defaults,
      },
      command.toJSONSchema,
    );

    expect(result.success).toBe(true);
  });
});

describe("defineCommand schema library acceptance (issue #5)", () => {
  it("accepts Valibot schemas for args and flags", () => {
    const argsSchema = v.tuple([v.string()]);
    const flagsSchema = v.object({ force: v.boolean(), region: v.string() });

    const command = defineCommand({
      args: argsSchema,
      flags: flagsSchema,
      async run() {},
    });

    expect(command.args).toBe(argsSchema);
    expect(command.flags).toBe(flagsSchema);
  });

  it("accepts the empty Valibot tuple/object repro from issue #5", () => {
    const command = defineCommand({
      args: v.tuple([]),
      flags: v.object({}),
      run() {},
    });

    expect(command.args).toBeDefined();
    expect(command.flags).toBeDefined();
  });

  it("infers Valibot output types for ctx.args and ctx.flags", () => {
    const command = defineCommand({
      args: v.tuple([v.string()]),
      flags: v.object({ force: v.boolean() }),
      async run({ args, flags }) {
        expectTypeOf(args).toEqualTypeOf<[string]>();
        expectTypeOf(flags).toEqualTypeOf<{ force: boolean }>();
      },
    });

    expect(command.args).toBeDefined();
    expect(command.flags).toBeDefined();
  });

  it("InferOutput extracts output types from Valibot schemas", () => {
    const argsSchema = v.tuple([v.string()]);
    const flagsSchema = v.object({ force: v.boolean() });

    type InferredArgs = InferOutput<typeof argsSchema>;
    type InferredFlags = InferOutput<typeof flagsSchema>;

    const args: InferredArgs = ["hello"];
    const flags: InferredFlags = { force: true };

    expect(args).toEqual(["hello"]);
    expect(flags).toEqual({ force: true });
  });

  it("accepts Zod v4 schemas and infers output types", () => {
    const argsSchema = z.tuple([z.string()]);
    const flagsSchema = z.object({ force: z.boolean().default(false) });

    const command = defineCommand({
      args: argsSchema,
      flags: flagsSchema,
      async run({ flags }) {
        expectTypeOf(flags).toEqualTypeOf<{ force: boolean }>();
      },
    });

    expect(command.args).toBe(argsSchema);
    expect(command.flags).toBe(flagsSchema);
  });
});
