import { z } from "zod";
import { defineCommand } from "@hacksaw/crate";

export default defineCommand({
  args: z.tuple([z.string()]),
  flags: z.object({
    verbose: z.boolean().default(false),
  }),
  hooks: {
    beforeRun: (ctx) => {
      ctx.log("[COMMAND HOOK] beforeRun executed");
      // Return modified context with added flag
      return {
        ...ctx,
        flags: {
          ...ctx.flags,
          hookModified: true,
        },
      };
    },
    afterRun: (ctx) => {
      ctx.log("[COMMAND HOOK] afterRun executed");
    },
    onError: (error, ctx) => {
      ctx.log?.("[COMMAND HOOK] onError:", error);
      return false;
    },
  },
  meta: {
    description: "Test command for hooks system",
    examples: ["my-cli test-hooks hello --verbose"],
  },
  async run({ args, flags, log }) {
    const [name] = args;
    log(`Hello ${name}!`);
    
    if (flags.verbose) {
      log("Verbose mode enabled");
    }
    
    // Check if hook modified the context
    if ((flags as Record<string, unknown>).hookModified) {
      log("✅ Context was modified by beforeRun hook");
    }
    
    log("Command executed successfully!");
  },
});
