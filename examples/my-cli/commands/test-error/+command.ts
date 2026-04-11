import { z } from "zod";
import { defineCommand } from "@hacksaw/crate";

export default defineCommand({
  args: z.tuple([]),
  flags: z.object({}),
  hooks: {
    onError: (error, ctx) => {
      ctx.log?.("[COMMAND HOOK] onError caught:", error instanceof Error ? error.message : error);
      // Swallow the error by returning true
      return true;
    },
  },
  meta: {
    description: "Test error handling with hooks",
    examples: ["my-cli test-error"],
  },
  async run({ log }) {
    log("About to throw an error...");
    throw new Error("Test error from command!");
  },
});
