import { z } from "zod";
import { defineCommand } from "@hacksaw/crate";

export default defineCommand({
  args: z.tuple([]).optional(),
  flags: z.object({
    verbose: z.boolean().default(false),
  }),
  meta: {
    description: "Root command - shows help or runs default action",
    examples: ["my-cli", "my-cli --verbose"],
  },
  async run({ log, flags }) {
    if (flags.verbose) {
      log("Running in verbose mode");
    }
    log("Hello from my-cli!");
    log("Run `my-cli --help` to see available commands");
  },
});
