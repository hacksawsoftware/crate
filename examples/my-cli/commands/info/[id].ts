import { z } from "zod";

// No args schema needed - the [id] is a dynamic route param
export const args = z.tuple([]).optional();

export const flags = z.object({
  json: z.boolean().default(false),
});

export const meta = {
  description: "Get info about a specific resource by ID",
  examples: ["my-cli info abc123", "my-cli info abc123 --json"],
};

export default async function ({ flags, log }: { flags: { json: boolean; id?: unknown }; log: (...args: unknown[]) => void }) {
  // Dynamic route param [id] is available via flags.id
  const id = flags.id as string;
  
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
}
