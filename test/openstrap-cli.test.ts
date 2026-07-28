import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { main } from "../src/CLI/Main.js";

describe("openstrap CLI", () => {
  it("runs the local sample and prints human output", async () => {
    const output = await captureCli(["run", "examples/openstrap/local-run.yaml"]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("OpenStrap run: passed");
    expect(output.stdout).toContain("node-runtime [local]: passed");
    expect(output.stderr).toBe("");
  });

  it("runs the local sample and prints JSON output", async () => {
    const output = await captureCli(["run", "examples/openstrap/local-run.yaml", "--json"]);
    const json = JSON.parse(output.stdout);

    expect(output.exitCode).toBe(0);
    expect(json.requirementRun.status).toBe("passed");
    expect(json.facts).toHaveLength(1);
  });

  it("does not let a plugin replace how a machine is read", async () => {
    const output = await captureCli([
      "run",
      "examples/openstrap/local-run.yaml",
      "--facts-backend",
      "test:plugin-backend",
      "--json",
    ]);

    expect(output.exitCode).toBe(2);
    expect(output.stderr).toContain("--facts-backend");
    expect(output.stdout).toBe("");
  });

  it("fails when an explicit run config path is missing instead of falling back to workspace config", async () => {
    const directory = mkdtempSync(join(tmpdir(), "openstrap-cli-explicit-"));

    try {
      writeFileSync(
        join(directory, "openstrap.yaml"),
        `
targets:
  local:
    requirements:
      - id: resources
        cpu:
          cores:
            minimum: 1
`,
      );

      const output = await captureCli(["run", join(directory, "missing.yaml")], directory);

      expect(output.exitCode).toBe(2);
      expect(output.stderr).toContain("Config file was not found");
      expect(output.stdout).toBe("");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("collects host facts with nothing declared, and keeps the result", async () => {
    const output = await captureCli(["facts", "collect", "host", "--json"]);
    const json = JSON.parse(output.stdout);
    const data = json.facts.snapshot.data;

    expect(output.exitCode).toBe(0);
    expect(data.os.name).not.toBe("");
    expect(Object.keys(data.processes).length).toBeGreaterThan(0);
    // Nothing was asked about by name, so nothing is answered by name.
    expect(data.commands).toEqual({});
    expect(data.paths).toEqual({});
    expect(json.storage.resultPath).toContain("/.openstrap/runs/facts/");
    expect(existsSync(json.storage.resultPath)).toBe(true);
    expect(JSON.parse(readFileSync(json.storage.resultPath, "utf8")).facts.snapshot.id)
      .toBe(json.facts.snapshot.id);
  });

  it("prints what it read", async () => {
    const output = await captureCli(["facts", "collect", "host"]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("OpenStrap facts collect: success");
    expect(output.stdout).toContain("Target: host");
    expect(output.stdout).toContain("Result file:");
    expect(output.stderr).toBe("");
  });

});

async function captureCli(argv: readonly string[], cwd = process.cwd()) {
  let stdout = "";
  let stderr = "";
  const exitCode = await main(["node", "openstrap", ...argv], {
    cwd,
    stdout: {
      write: (chunk: string) => {
        stdout += chunk;
        return true;
      },
    } as any,
    stderr: {
      write: (chunk: string) => {
        stderr += chunk;
        return true;
      },
    } as any,
  });

  return {
    exitCode,
    stdout,
    stderr,
  };
}
