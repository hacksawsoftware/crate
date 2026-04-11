import { z } from "zod";
import { defineCommand } from "@hacksaw/crate";

export default defineCommand({
  args: z.tuple([]),
  flags: z.object({}),
  hooks: {
    onError: (error, ctx) => {
      ctx.log?.("[COMMAND HOOK] onError caught but not swallowing:", error instanceof Error ? error.message : error);
      // Don't swallow - return false/void
      return false;
    },
  },
  meta: {
    description: "Test error handling without swallowing",
    examples: ["my-cli test-error-fatal"],
  },
  async run({ log }) {
    log("About to throw an error that will crash...");
    throw new Error("Fatal test error!");
  },
});
