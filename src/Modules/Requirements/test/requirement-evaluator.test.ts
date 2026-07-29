import { describe, expect, it } from "vitest";

import { RequirementEvaluator, type RequirementLeafCheck, type TargetlessRequirement } from "../index.js";

describe("RequirementEvaluator", () => {
  it("passes when all leaf checks match normalized facts", () => {
    const run = evaluate([
      {
        id: "docker-runtime",
        runtimes: {
          docker: {
            ready: true,
            version: ">=24.0.0",
          },
        },
      },
    ]);

    expect(run.status).toBe("passed");
    expect(run.results[0]!.status).toBe("passed");
  });

  it("aggregates failed leaf checks into failed result and run status", () => {
    const run = evaluate([
      {
        id: "docker-runtime",
        runtimes: {
          docker: {
            ready: false,
            version: ">=25.0.0",
          },
        },
      },
    ]);

    expect(run.status).toBe("failed");
    expect(run.results[0]!.status).toBe("failed");
    expect(leaf(run.results[0]!.checks, ["runtimes", "docker", "version"]).status).toBe("failed");
  });

  it("returns error when target snapshot is missing", () => {
    const run = new RequirementEvaluator().evaluate({
      requirements: [
        {
          id: "node-runtime",
          runtimes: {
            node: {
              ready: true,
            },
          },
        },
      ],
      target: { name: "host", type: "machine" },
      snapshots: snapshots(),
      now: new Date("2026-06-08T10:00:00.000Z"),
    });

    expect(run.status).toBe("error");
    expect(run.results[0]!.snapshotId).toBeNull();
  });

  it("treats absent observed selectors as failed when the checked field is missing", () => {
    const run = evaluate([
      {
        id: "ssh-service",
        services: {
          ssh: {
            running: true,
          },
        },
      },
    ]);

    const check = leaf(run.results[0]!.checks, ["services", "ssh", "running"]);
    expect(check.status).toBe("failed");
    expect(check.actual).toBeNull();
    expect(run.status).toBe("failed");
  });

  it("treats unknown, unsupported, and error observed selectors as check errors", () => {
    for (const status of ["unknown", "unsupported", "error"] as const) {
      const run = evaluate([
        {
          id: `${status}-service`,
          services: {
            [status]: {
              running: true,
            },
          },
        },
      ]);

      expect(leaf(run.results[0]!.checks, ["services", status, "running"]).status).toBe("error");
      expect(run.status).toBe("error");
    }
  });

  it("does not let optional requirements rewrite failed status", () => {
    const run = evaluate([
      {
        id: "optional-docker",
        optional: true,
        runtimes: {
          docker: {
            ready: false,
          },
        },
      },
    ]);

    expect(run.results[0]!.status).toBe("failed");
    expect(run.status).toBe("failed");
  });

  it("returns error for non-SemVer actual versions", () => {
    const run = evaluate([
      {
        id: "bad-version",
        runtimes: {
          badVersion: {
            version: ">=1.0.0",
          },
        },
      },
    ]);

    expect(leaf(run.results[0]!.checks, ["runtimes", "badVersion", "version"]).status).toBe("error");
    expect(run.status).toBe("error");
  });
  it("checks a list for membership rather than for equality", () => {
    const passing = evaluate([{ id: "in-sudo", users: { openstrap: { groups: { contains: "sudo" } } } }]);
    const failing = evaluate([{ id: "in-docker", users: { openstrap: { groups: { contains: "docker" } } } }]);
    const notAList = evaluate([{ id: "in-shell", users: { openstrap: { shell: { contains: "bash" } } } }]);

    expect(passing.results[0]!.status).toBe("passed");
    expect(failing.results[0]!.status).toBe("failed");
    expect(leaf(failing.results[0]!.checks, ["users", "openstrap", "groups"]).details?.message)
      .toContain("expected contains");
    expect(notAList.results[0]!.status).toBe("error");
  });
});

function evaluate(requirements: TargetlessRequirement[]) {
  return new RequirementEvaluator().evaluate({
    requirements,
    target: { name: "guest", type: "vm" },
    snapshots: snapshots(),
    now: new Date("2026-06-08T10:00:00.000Z"),
  });
}

function snapshots() {
  return [
    {
      id: "snap_guest",
      target: { id: "guest" },
      facts: {
        users: {
          openstrap: {
            status: "present",
            name: "openstrap",
            uid: 1000,
            shell: "/bin/bash",
            groups: ["openstrap", "sudo"],
          },
        },
        runtimes: {
          docker: { status: "present", type: "docker", ready: true, version: "24.0.1" },
          badVersion: { status: "present", type: "example", version: "not-a-version" },
        },
        services: {
          ssh: { status: "absent" },
          unknown: { status: "unknown" },
          unsupported: { status: "unsupported" },
          error: { status: "error" },
        },
      },
    },
  ];
}

function leaf(node: any, path: readonly string[]): RequirementLeafCheck {
  let current = node;

  for (const part of path) {
    current = current[part];
  }

  return current;
}
