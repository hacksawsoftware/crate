import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./index.js";

const testDir = dirname(fileURLToPath(import.meta.url));

describe("run() commands directory resolution", () => {
  let previousCwd: string;
  let previousArgv: string[];

  beforeEach(() => {
    previousCwd = process.cwd();
    previousArgv = process.argv;
  });

  afterEach(() => {
    process.chdir(previousCwd);
    process.argv = previousArgv;
    vi.restoreAllMocks();
  });

  it("resolves the default commands dir relative to the caller of run() (issue #4)", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    process.chdir(tmpdir());
    process.argv = ["node", "test-cli", "hello"];

    await run({ name: "test-cli" });

    expect(logSpy).toHaveBeenCalledWith("hello from fixture");
  });

  it("resolves an explicit relative commandsDir relative to the caller of run()", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    process.chdir(tmpdir());
    process.argv = ["node", "test-cli", "ping"];

    await run({ name: "test-cli", commandsDir: "./fixtures/commands-alt" });

    expect(logSpy).toHaveBeenCalledWith("ping from fixture");
  });

  it("passes an absolute commandsDir through unchanged", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    process.chdir(tmpdir());
    process.argv = ["node", "test-cli", "ping"];

    await run({ name: "test-cli", commandsDir: join(testDir, "fixtures", "commands-alt") });

    expect(logSpy).toHaveBeenCalledWith("ping from fixture");
  });

  it("rejects with a helpful error when the resolved commands dir is missing", async () => {
    process.chdir(tmpdir());
    process.argv = ["node", "test-cli"];

    await expect(run({ name: "test-cli", commandsDir: "does-not-exist" })).rejects.toThrow(
      /Commands directory not found/,
    );
  });
});
