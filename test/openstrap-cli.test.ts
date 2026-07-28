import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { main } from "../src/CLI/Application/Main.js";

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
  local: {}

requirements:
  - id: resources
    target: local
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

  it("collects host facts from the default facts definition YAML", async () => {
    const output = await captureCli(["facts", "collect", "host", "--json"]);
    const json = JSON.parse(output.stdout);

    expect(output.exitCode).toBe(0);
    expect(json.definition.id).toBe("system-inventory");
    expect(json.facts).toHaveLength(1);

    const data = json.facts[0].snapshot.data;

    expect(Object.keys(data.processes).length).toBeGreaterThan(0);
    expect(data.processes).toHaveProperty("node-process");
    expect(data.paths["tree-root"]).toMatchObject({ status: "present", type: "directory" });
    expect(data.artifacts).toHaveProperty("tree-root-metadata");
    expect(data.artifacts["tree-root-metadata"].status).toBe("present");
    // The definition declares `services: []`, so nothing was asked about and
    // nothing is reported. A machine is never asked for all of its services.
    expect(data.services).toEqual({});
    expect(json.storage.resultPath).toContain("/.openstrap/runs/facts/");
    expect(existsSync(json.storage.resultPath)).toBe(true);
    expect(JSON.parse(readFileSync(json.storage.resultPath, "utf8")).definition.id).toBe("system-inventory");
  });

  it("collects host facts from an explicit facts definition YAML", async () => {
    const output = await captureCli(["facts", "collect", "host", "examples/facts/system-inventory.yaml"]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("OpenStrap facts collect: success");
    expect(output.stdout).toContain("Target: host");
    expect(output.stdout).toContain("Result file:");
    expect(output.stdout).toContain("processes (");
    expect(output.stdout).toContain("artifacts (");
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
