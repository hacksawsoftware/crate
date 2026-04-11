import { run } from "@hacksaw/crate";
import { join } from "node:path";

run({
  name: "cat-example",
  version: "1.0.0",
  description: "A basic cat implementation using zod for schema validation",
  commandsDir: join(import.meta.dirname, "commands"),
});
