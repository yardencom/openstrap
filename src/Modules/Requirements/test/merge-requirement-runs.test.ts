import { describe, expect, it } from "vitest";

import {
  mergeRequirementRuns,
  MergedRunWithoutTargetsError,
} from "../Application/MergeRequirementRuns.js";
import type { CheckStatus, RequirementRun } from "../Domain/Requirements.js";

describe("merging one evaluation per target", () => {
  it("refuses to merge nothing, because a run cannot be made out of nothing", () => {
    expect(() => mergeRequirementRuns([])).toThrow(MergedRunWithoutTargetsError);
  });

  it("hands back a single run untouched", () => {
    const only = run("passed", { target: "host", requirementId: "a" });

    expect(mergeRequirementRuns([only])).toBe(only);
  });

  it("keeps every result and says which target each came from", () => {
    const merged = mergeRequirementRuns([
      run("passed", { target: "host", requirementId: "node-runtime" }),
      run("passed", { target: "guest", requirementId: "ssh-running" }),
    ]);

    expect(merged.results.map((result) => [result.target, result.requirementId])).toEqual([
      ["host", "node-runtime"],
      ["guest", "ssh-running"],
    ]);
    expect(merged.targets).toEqual({ host: "machine", guest: "machine" });
  });

  it("is as bad as its worst target", () => {
    const worst: Array<[CheckStatus[], CheckStatus]> = [
      [["passed", "passed"], "passed"],
      [["passed", "failed"], "failed"],
      [["failed", "error"], "error"],
      [["passed", "error"], "error"],
      [["skipped", "passed"], "passed"],
      [["skipped", "skipped"], "skipped"],
    ];

    for (const [statuses, expected] of worst) {
      const merged = mergeRequirementRuns(statuses.map((status, index) =>
        run(status, { target: `t${index}`, requirementId: `r${index}` }),
      ));

      expect(merged.status, statuses.join("+")).toBe(expected);
    }
  });

  it("explains a failure by naming what the failing targets said", () => {
    const merged = mergeRequirementRuns([
      { ...run("failed", { target: "host", requirementId: "a" }), details: { message: "host is short of memory" } },
      { ...run("error", { target: "guest", requirementId: "b" }), details: { message: "guest did not answer" } },
      { ...run("passed", { target: "third", requirementId: "c" }), details: { message: "nothing wrong here" } },
    ]);

    expect(merged.details?.message).toBe("host is short of memory; guest did not answer");
  });

  it("says nothing extra when everything passed", () => {
    const merged = mergeRequirementRuns([
      run("passed", { target: "host", requirementId: "a" }),
      run("passed", { target: "guest", requirementId: "b" }),
    ]);

    expect(merged.details).toBeUndefined();
  });
});

function run(status: CheckStatus, result: { target: string; requirementId: string }): RequirementRun {
  return {
    id: `req_run_${result.target}`,
    status,
    startedAt: "2026-06-08T10:00:00.000Z",
    finishedAt: "2026-06-08T10:00:00.000Z",
    durationMs: 0,
    attempt: 1,
    trigger: "manual",
    profile: "local-run",
    purpose: "preflight",
    targets: { [result.target]: "machine" },
    results: [{
      requirementId: result.requirementId,
      target: result.target,
      facts: { snapshotId: `snap_${result.target}`, factRunId: `fact_run_${result.target}` },
      status,
      checks: { status, expected: { passed: status === "passed", value: true }, actual: true },
    }],
  };
}
