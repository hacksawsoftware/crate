import { z } from "zod";

export const args = z.tuple([z.string()]);

export const flags = z.object({
  dryRun: z.boolean().default(false),
});

export const meta = {
  description: "Run database migrations",
  examples: ["my-cli db migrate up", "my-cli db migrate down --dry-run"],
};

export default async function ({ args, flags, log, error }: { args: [string]; flags: { dryRun: boolean }; log: (...args: unknown[]) => void; error: (...args: unknown[]) => void }) {
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
}
