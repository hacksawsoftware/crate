import { describe, it, expect } from "vitest";
import { defineCommand } from "./define.js";
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
