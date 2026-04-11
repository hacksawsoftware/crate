import { z } from "zod";
import { defineCommand } from "@hacksaw/crate";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { Readable } from "node:stream";

export default defineCommand({
  args: z.tuple([z.string()]).rest(z.string()),
  flags: z.object({
    number: z.boolean().default(false),
    "number-nonblank": z.boolean().default(false),
    showEnds: z.boolean().default(false),
    showTabs: z.boolean().default(false),
    squeezeBlank: z.boolean().default(false),
  }),
  meta: {
    description: "Concatenate and print files",
    examples: [
      "cat-example file.txt",
      "cat-example file1.txt file2.txt",
      "cat-example --number file.txt",
      "cat-example -n file.txt",
      "cat-example --show-ends file.txt",
      "cat-example --show-tabs file.txt",
    ],
  },
  async run({ args, flags, stdout, error }) {
    const files = args;

    if (files.length === 0) {
      // Read from stdin if no files specified
      await readStream(stdin, flags, stdout, 0);
      return;
    }

    let lineNumber = 1;

    for (let i = 0; i < files.length; i++) {
      const filePath = resolve(files[i]);

      // Check if file exists
      if (!existsSync(filePath)) {
        error(`cat: ${files[i]}: No such file or directory`);
        continue;
      }

      // Check if it's a directory
      try {
        const stats = statSync(filePath);
        if (stats.isDirectory()) {
          error(`cat: ${files[i]}: Is a directory`);
          continue;
        }
      } catch {
        error(`cat: ${files[i]}: Cannot stat file`);
        continue;
      }

      try {
        const stream = createReadStream(filePath, { encoding: "utf8" });
        lineNumber = await readStream(stream, flags, stdout, lineNumber);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`cat: ${files[i]}: ${message}`);
      }
    }
  },
});

// Helper to read a stream and output with formatting
async function readStream(
  stream: Readable,
  flags: {
    number: boolean;
    "number-nonblank": boolean;
    showEnds: boolean;
    showTabs: boolean;
    squeezeBlank: boolean;
  },
  stdout: NodeJS.WriteStream,
  startLineNumber: number,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let lineNumber = startLineNumber;
    let buffer = "";
    let lastLineWasBlank = false;

    stream.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (let line of lines) {
        // Handle squeeze-blank: skip consecutive blank lines
        const isBlank = line === "";
        if (flags.squeezeBlank && isBlank && lastLineWasBlank) {
          continue;
        }
        lastLineWasBlank = isBlank;

        // Handle show-tabs
        if (flags.showTabs) {
          line = line.replace(/\t/g, "^I");
        }

        // Handle line numbering
        if (flags["number-nonblank"]) {
          if (!isBlank) {
            line = `${String(lineNumber).padStart(6)}  ${line}`;
            lineNumber++;
          }
        } else if (flags.number) {
          line = `${String(lineNumber).padStart(6)}  ${line}`;
          lineNumber++;
        }

        // Handle show-ends
        if (flags.showEnds) {
          line += "$";
        }

        stdout.write(line + "\n");
      }
    });

    stream.on("end", () => {
      // Handle any remaining content in buffer (file without trailing newline)
      if (buffer) {
        let line = buffer;

        // Handle show-tabs
        if (flags.showTabs) {
          line = line.replace(/\t/g, "^I");
        }

        // Handle line numbering
        if (flags["number-nonblank"] && line !== "") {
          line = `${String(lineNumber).padStart(6)}  ${line}`;
          lineNumber++;
        } else if (flags.number) {
          line = `${String(lineNumber).padStart(6)}  ${line}`;
          lineNumber++;
        }

        // Handle show-ends
        if (flags.showEnds) {
          line += "$";
        }

        stdout.write(line);
      }

      resolve(lineNumber);
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

// Create a readable stream from stdin
const stdin = process.stdin;
