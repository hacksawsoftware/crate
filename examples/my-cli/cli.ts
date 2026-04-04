import { run } from "@hacksaw/crate";
import { join } from "node:path";

run({
  name: "my-cli",
  version: "1.0.0",
  description: "Example CLI demonstrating file-based routing",
  commandsDir: join(import.meta.dirname, "commands"),
  hooks: {
    beforeMatch: ({ argv }) => {
      // If someone types "my-cli greet <name>", rewrite it to "my-cli test-argv-mod <name>"
      if (argv[0] === "greet") {
        return { argv: ["test-argv-mod", ...argv.slice(1)] };
      }
      return { argv };
    },
    beforeLoad: ({ route }) => {
      console.log("[CLI HOOK] beforeLoad:", route.segments.join("/"));
    },
    beforeRun: (ctx) => {
      console.log("[CLI HOOK] beforeRun - CLI-level middleware");
      // Add CLI-level flag to context
      return {
        ...ctx,
        flags: {
          ...ctx.flags,
          cliModified: true,
        },
      };
    },
    afterRun: () => {
      console.log("[CLI HOOK] afterRun - cleanup");
    },
    onError: (error) => {
      console.log("[CLI HOOK] onError:", error instanceof Error ? error.message : error);
      // Don't swallow errors by default
      return false;
    },
  },
});
