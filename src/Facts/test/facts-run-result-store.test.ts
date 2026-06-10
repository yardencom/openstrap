import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CollectFactsFromDefinitionResult } from "../Application/CollectFactsFromDefinition.js";
import { FactsRunResultStore } from "../Application/FactsRunResultStore.js";

describe("FactsRunResultStore", () => {
  it("stores collected facts under .openstrap/runs/facts/<factRunId>/result.json", () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "openstrap-facts-store-"));

    try {
      const result = new FactsRunResultStore().storeCollectedFacts({
        workspaceRoot,
        result: factsCollectResult("fact_run_host_20260609T000000000Z"),
      });

      expect(result.storage.runDirectory).toBe(
        join(workspaceRoot, ".openstrap", "runs", "facts", "fact_run_host_20260609T000000000Z"),
      );
      expect(result.storage.resultPath).toBe(join(result.storage.runDirectory, "result.json"));
      expect(existsSync(result.storage.resultPath)).toBe(true);
      expect(JSON.parse(readFileSync(result.storage.resultPath, "utf8"))).toEqual(result);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("rejects an empty collected facts result", () => {
    expect(() => new FactsRunResultStore().storeCollectedFacts({
      workspaceRoot: "/tmp/openstrap",
      result: {
        ...factsCollectResult("fact_run_host_20260609T000000000Z"),
        facts: [],
      },
    })).toThrow("Collected facts result must contain at least one fact item");
  });
});

function factsCollectResult(runId: string): CollectFactsFromDefinitionResult {
  return {
    definition: {
      id: "system-inventory",
      version: 1,
      description: "System inventory",
    },
    facts: [{
      snapshot: {
        id: "snap_host_20260609T000000000Z",
        schemaVersion: "facts.v1",
        scope: "host",
        target: {
          type: "machine",
          id: "host",
        },
        data: {
          os: {
            family: "macos",
            name: "darwin",
            version: "24.6.0",
          },
          arch: "arm64",
          cpu: {
            cores: 10,
          },
          memory: {
            totalBytes: 17179869184,
          },
          storage: {
            mounts: {},
          },
          network: {
            interfaces: {},
            dns: {},
            ports: {},
            firewall: {
              status: "unknown",
            },
            reachability: {},
          },
          users: {},
          packages: {
            managers: {},
          },
          processes: {},
          services: {},
          transports: {},
          privileges: {},
          runtimes: {},
          providers: {},
          caches: {},
        },
      },
      run: {
        id: runId,
        snapshotId: "snap_host_20260609T000000000Z",
        startedAt: "2026-06-09T00:00:00.000Z",
        finishedAt: "2026-06-09T00:00:00.000Z",
        status: "success",
      },
    }],
    evidence: {
      commands: {},
      artifacts: {},
    },
  };
}
