import { describe, expect, it } from "vitest";

import { Unmet } from "../plan/Unmet.js";
import type { RequirementLeafCheck, RequirementResult, RequirementRun } from "#types/Requirements.js";

describe("what a machine was required to be and is not", () => {
  it("names the place in the facts, not the place in the requirement", () => {
    const unmet = Unmet.ofOne(result("kubernetes-running", {
      network: { ports: { "tcp/6443": { state: leaf("failed", "listening", null) } } },
    }));

    expect(unmet).toEqual([{
      requirementId: "kubernetes-running",
      path: "network.ports.tcp/6443.state",
      expected: "listening",
      actual: null,
      message: "network.ports.tcp/6443.state expected listening, got absent",
    }]);
  });

  it("takes what failed and leaves what passed", () => {
    const unmet = Unmet.ofOne(result("machine-fits-a-cluster", {
      cpu: { cores: leaf("passed", { minimum: 2 }, 4) },
      memory: { totalBytes: leaf("failed", { minimum: 3800000000 }, 2050000000) },
    }));

    expect(unmet.map((one) => one.path)).toEqual(["memory.totalBytes"]);
    expect(unmet[0]!.actual).toBe(2050000000);
  });

  it("leaves a check that could not be made alone", () => {
    // `error` says openstrap could not read the machine there. A machine nobody could read is not a
    // machine that fell short, and running commands on it would be acting on an answer nobody has.
    const unmet = Unmet.ofOne(result("kubernetes-running", {
      services: { k3s: { running: leaf("error", true, null) } },
    }));

    expect(unmet).toEqual([]);
  });

  it("reads every requirement of a run, and says which one asked", () => {
    const run: RequirementRun = {
      id: "req_run_1", status: "failed", evaluatedAt: "2026-08-03T00:00:00.000Z",
      attempt: 1, trigger: "converge", profile: "local-vm", purpose: "converge",
      targets: { host: "host" },
      results: [
        result("database-listening", { network: { ports: { "tcp/5432": { state: leaf("failed", "listening", null) } } } }),
        result("server-answering", { network: { ports: { "tcp/8080": { state: leaf("failed", "listening", null) } } } }),
      ],
    };

    expect(Unmet.in(run).map((one) => `${one.requirementId} ${one.path}`)).toEqual([
      "database-listening network.ports.tcp/5432.state",
      "server-answering network.ports.tcp/8080.state",
    ]);
  });
});

function result(requirementId: string, checks: RequirementResult["checks"]): RequirementResult {
  return { requirementId, target: "host", snapshotId: "snap_host_1", status: "failed", checks };
}

function leaf(status: RequirementLeafCheck["status"], expected: unknown, actual: unknown): RequirementLeafCheck {
  return {
    status,
    expected: { passed: status === "passed" ? true : status === "failed" ? false : null, value: expected },
    actual,
    details: { message: "network.ports.tcp/6443.state expected listening, got absent" },
  };
}
