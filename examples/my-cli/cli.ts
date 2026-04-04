import { run } from "@hacksaw/crate";

run({
  name: "my-cli",
  version: "1.0.0",
  description: "Example CLI demonstrating file-based routing",
  commandsDir: "./commands",
});
