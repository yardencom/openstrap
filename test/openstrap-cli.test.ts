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

  it("runs the local sample through an external facts backend plugin", async () => {
    const directory = mkdtempSync(join(tmpdir(), "openstrap-cli-plugin-"));
    const pluginPath = join(directory, "plugin.mjs");

    try {
      writeFileSync(pluginPath, `
        export default {
          name: "test-cli-plugin",
          setup(api) {
            api.registerFactsBackend({
              id: "test:plugin-backend",
              capabilities: {
                scopes: ["host"],
                transports: ["local"],
                sections: ["cpu", "memory", "paths", "runtimes", "transports"]
              },
              collect(request) {
                const target = request.targets[0].target;

                return [{
                  snapshot: {
                    id: "snap_test_plugin",
                    schemaVersion: "facts.v1",
                    scope: target.scope,
                    target: {
                      type: target.type,
                      id: target.name
                    },
                    data: {
                      cpu: { cores: 8 },
                      memory: { totalBytes: 17179869184 },
                      paths: {
                        workspace: {
                          status: "present",
                          path: request.workspaceRoot,
                          exists: true,
                          type: "directory",
                          readable: true
                        }
                      },
                      runtimes: {
                        node: {
                          status: "present",
                          type: "node",
                          version: "99.0.0",
                          ready: true
                        }
                      },
                      transports: {
                        local: {
                          status: "present",
                          type: "local",
                          ready: true
                        }
                      }
                    }
                  },
                  run: {
                    id: "fact_run_test_plugin",
                    snapshotId: "snap_test_plugin",
                    startedAt: "2026-06-09T00:00:00.000Z",
                    finishedAt: "2026-06-09T00:00:00.000Z",
                    status: "success"
                  }
                }];
              }
            });
          }
        };
      `);

      const output = await captureCli([
        "run",
        "examples/openstrap/local-run.yaml",
        "--plugin",
        pluginPath,
        "--facts-backend",
        "test:plugin-backend",
        "--json",
      ]);
      const json = JSON.parse(output.stdout);

      expect(output.exitCode).toBe(0);
      expect(json.requirementRun.status).toBe("passed");
      expect(json.facts[0].run.id).toBe("fact_run_test_plugin");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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
  - id: local-transport
    target: local
    transports:
      local:
        ready: true
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
    expect(Object.keys(json.facts[0].snapshot.data.processes).length).toBeGreaterThan(0);
    expect(Object.keys(json.facts[0].snapshot.data.services).length).toBeGreaterThan(0);
    expect(json.facts[0].snapshot.data.processes).toHaveProperty("node-process");
    expect(json.evidence.artifacts).toHaveProperty("tree-root-metadata");
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
    expect(output.stdout).toContain("Processes (");
    expect(output.stdout).toContain("Services (");
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
