import { run } from "@hacksaw/crate";
import { join } from "node:path";

run({
  name: "ls-example",
  version: "1.0.0",
  description: "A basic ls implementation using valibot for schema validation",
  commandsDir: join(import.meta.dirname, "commands"),
});
