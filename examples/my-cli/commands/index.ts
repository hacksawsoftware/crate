import { z } from "zod";

export const args = z.tuple([]).optional();

export const flags = z.object({
  verbose: z.boolean().default(false),
});

export const meta = {
  description: "Root command - shows help or runs default action",
  examples: ["my-cli", "my-cli --verbose"],
};

export default async function ({ log, flags }) {
  if (flags.verbose) {
    log("Running in verbose mode");
  }
  log("Hello from my-cli!");
  log("Run `my-cli --help` to see available commands");
}
