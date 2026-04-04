import { z } from "zod";
import { defineCommand } from "@hacksaw/crate";

export default defineCommand({
  args: z.tuple([z.string()]),
  flags: z.object({
    dryRun: z.boolean().default(false),
  }),
  meta: {
    description: "Run database migrations",
    examples: ["my-cli db migrate up", "my-cli db migrate down --dry-run"],
  },
  async run({ args, flags, log, error }) {
    const [direction] = args;

    if (direction !== "up" && direction !== "down") {
      error(`❌ Invalid direction: ${direction}. Use 'up' or 'down'`);
      process.exit(1);
    }

    if (flags.dryRun) {
      log(`🔍 Dry run: Would run migrations ${direction}`);
      return;
    }

    log(`🗄️  Running migrations ${direction}...`);
    log(`✅ Migrations completed!`);
  },
});
