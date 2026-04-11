import { z } from "zod";
import { defineCommand } from "@hacksaw/crate";

export default defineCommand({
  args: z.tuple([z.string()]),
  flags: z.object({}),
  meta: {
    description: "Test beforeMatch argv modification",
    examples: ["my-cli test-argv-mod"],
  },
  async run({ args, log }) {
    const [name] = args;
    log(`Received arg: ${name}`);
  },
});
