import { z } from "zod";
import { defineCommand } from "@hacksaw/crate";

export default defineCommand({
  // No args schema needed - the [id] is a dynamic route param
  args: z.tuple([]).optional(),
  flags: z.object({
    json: z.boolean().default(false),
    // Dynamic route params are injected at runtime, add to schema for type safety
    id: z.string().optional(),
  }),
  meta: {
    description: "Get info about a specific resource by ID",
    examples: ["my-cli info abc123", "my-cli info abc123 --json"],
  },
  async run({ flags, log }) {
    // Dynamic route param [id] is available via flags.id
    const id = flags.id;

    if (!id) {
      log("Error: ID is required");
      return;
    }

    const info = {
      id,
      name: `Resource ${id}`,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    if (flags.json) {
      log(JSON.stringify(info, null, 2));
    } else {
      log(`ID: ${info.id}`);
      log(`Name: ${info.name}`);
      log(`Status: ${info.status}`);
      log(`Created: ${info.createdAt}`);
    }
  },
});
