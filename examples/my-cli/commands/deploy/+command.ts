import { z } from "zod";
import { defineCommand } from "@hacksaw/crate";

export default defineCommand({
  args: z.tuple([z.literal(["production", "staging"])]),
  flags: z.object({
    force: z.boolean().default(false),
    region: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
  meta: {
    description: "Deploy the application to a target environment",
    examples: [
      "my-cli deploy production",
      "my-cli deploy staging --force",
      "my-cli deploy production --region us-east-1 --tags v1.0 --tags latest",
    ],
  },
  async run({ args, flags, log }) {
    const [target] = args;

    log(`🚀 Deploying to ${target}...`);

    if (flags.region) {
      log(`📍 Region: ${flags.region}`);
    }

    if (flags.tags.length > 0) {
      log(`🏷️  Tags: ${flags.tags.join(", ")}`);
    }

    if (flags.force) {
      log("⚠️  Force mode enabled - skipping confirmations");
    }

    log(`✅ Successfully deployed to ${target}!`);
  },
});
