import { run } from "@hacksaw/crate";
import { join } from "node:path";

run({
  name: "my-cli",
  version: "1.0.0",
  description: "Example CLI demonstrating file-based routing",
  commandsDir: join(import.meta.dirname, "commands"),
});
