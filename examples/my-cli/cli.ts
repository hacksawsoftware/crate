import { run } from "../../dist/index.js";

run({
  name: "my-cli",
  version: "1.0.0",
  description: "Example CLI demonstrating file-based routing",
  commandsDir: "./commands",
});
