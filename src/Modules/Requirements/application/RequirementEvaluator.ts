import { isDeepStrictEqual } from "node:util";

import { satisfies, valid, validRange } from "semver";

import type {
  CheckStatus,
  RequirementCheckNode,
  RequirementLeafCheck,
  RequirementResult,
  RequirementRun,
  RequirementTarget,
  TargetlessRequirement,
} from "../types/Requirements.js";

type ObservedStatus = "present" | "absent" | "unknown" | "unsupported" | "error";

type Observed = {
  status: ObservedStatus;
  reason?: string;
  message?: string;
};

/**
 * A snapshot as this module needs to read one.
 *
 * Spelled here rather than imported, so a requirement check depends on the shape it compares
 * against and not on the module that produces it.
 */
type FactSnapshot = {
  id: { toString(): string };
  target: { id: string };
  facts: unknown;
};

const requirementMetaFields = new Set(["id", "optional"]);
const assertionKeys = new Set([
  "const",
  "enum",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "contains",
]);
const terminalObservedStatuses = new Set<ObservedStatus>(["unknown", "unsupported", "error"]);

export class RequirementEvaluator {
  evaluate(params: {
    target: RequirementTarget;
    requirements: readonly TargetlessRequirement[];
    snapshots: readonly FactSnapshot[];
    now?: Date;
    attempt?: number;
    trigger?: string;
    profile?: string;
    purpose?: string;
  }): RequirementRun {
    const evaluatedAt = params.now ?? new Date();
    const snapshotsByTarget = byTarget(params.snapshots);
    const results = params.requirements.map((requirement) =>
      this.evaluateRequirement(requirement, params.target.name, snapshotsByTarget.get(params.target.name)),
    );
    const status = aggregateStatuses(results.map((result) => result.status));

    return {
      id: stableId("req_run", evaluatedAt.toISOString()),
      status,
      evaluatedAt: evaluatedAt.toISOString(),
      attempt: params.attempt ?? 1,
      trigger: params.trigger ?? "manual",
      profile: params.profile ?? "local-vm-preflight",
      purpose: params.purpose ?? "preflight",
      targets: {
        [params.target.name]: params.target.name,
      },
      results,
      details: status === "passed" ? undefined : {
        message: summarizeResults(results),
      },
    };
  }

  private evaluateRequirement(
    requirement: TargetlessRequirement,
    targetName: string,
    snapshot: FactSnapshot | undefined,
  ): RequirementResult {
    const checkBlocks = extractCheckBlocks(requirement);

    if (!snapshot) {
      const checks = buildLeafChecks(checkBlocks, "error", "No FactSnapshot was collected for requirement target");

      return {
        requirementId: requirement.id,
        target: targetName,
        snapshotId: null,
        status: "error",
        checks,
      };
    }

    const checks = evaluateNode({
      expected: checkBlocks,
      actual: snapshot.facts,
      path: [],
      observedAncestor: undefined,
    });

    return {
      requirementId: requirement.id,
      target: targetName,
      snapshotId: String(snapshot.id),
      status: aggregateCheckNode(checks),
      checks,
    };
  }
}

function evaluateNode(params: {
  expected: unknown;
  actual: unknown;
  path: readonly string[];
  observedAncestor: Observed | undefined;
}): RequirementCheckNode {
  if (isRecord(params.expected) && !isAssertionObject(params.expected)) {
    const currentObserved = asObserved(params.actual) ?? params.observedAncestor;
    const checks: Record<string, RequirementCheckNode> = {};

    for (const [key, expectedValue] of Object.entries(params.expected)) {
      const actualValue = isRecord(params.actual) ? params.actual[key] : undefined;
      checks[key] = evaluateNode({
        expected: expectedValue,
        actual: actualValue,
        path: [...params.path, key],
        observedAncestor: currentObserved,
      });
    }

    return checks;
  }

  return evaluateLeaf(params.expected, params.actual, params.path, params.observedAncestor);
}

function evaluateLeaf(
  expected: unknown,
  actual: unknown,
  path: readonly string[],
  observedAncestor: Observed | undefined,
): RequirementLeafCheck {
  const fieldName = path[path.length - 1] ?? "";

  if (actual === undefined) {
    if (observedAncestor?.status === "absent") {
      return leaf("failed", expected, null, `${path.join(".")} expected ${formatValue(expected)}, got absent`);
    }

    if (observedAncestor && terminalObservedStatuses.has(observedAncestor.status)) {
      return leaf("error", expected, null, `${path.join(".")} cannot be verified: ${observedAncestor.status}`);
    }

    return leaf("error", expected, null, `${path.join(".")} is missing from normalized facts`);
  }

  if (fieldName !== "status" && observedAncestor && terminalObservedStatuses.has(observedAncestor.status)) {
    return leaf("error", expected, actual, `${path.join(".")} cannot be verified: ${observedAncestor.status}`);
  }

  const evaluation = evaluateCondition(fieldName, expected, actual);

  return leaf(
    evaluation.status,
    expected,
    actual,
    evaluation.message ?? `${path.join(".")} expected ${formatValue(expected)}, got ${formatValue(actual)}`,
  );
}

function evaluateCondition(
  fieldName: string,
  expected: unknown,
  actual: unknown,
): { status: CheckStatus; message?: string } {
  if (fieldName === "version" && typeof expected === "string" && validRange(expected)) {
    if (typeof actual !== "string" || !valid(actual)) {
      return {
        status: "error",
        message: `version expected ${expected}, got non-SemVer value ${formatValue(actual)}`,
      };
    }

    return {
      status: satisfies(actual, expected) ? "passed" : "failed",
      message: `version expected ${expected}, got ${actual}`,
    };
  }

  if (isAssertionObject(expected)) {
    return evaluateAssertions(expected, actual);
  }

  return {
    status: isDeepStrictEqual(actual, expected) ? "passed" : "failed",
  };
}

function evaluateAssertions(expected: Record<string, unknown>, actual: unknown): { status: CheckStatus; message?: string } {
  const failures: string[] = [];

  if ("const" in expected && !isDeepStrictEqual(actual, expected.const)) {
    failures.push(`expected const ${formatValue(expected.const)}`);
  }

  if ("enum" in expected) {
    if (!Array.isArray(expected.enum)) {
      return {
        status: "error",
        message: "enum assertion must be an array",
      };
    }

    if (!expected.enum.some((value) => isDeepStrictEqual(value, actual))) {
      failures.push(`expected enum ${formatValue(expected.enum)}`);
    }
  }

  const numericKeys = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"];
  if (numericKeys.some((key) => key in expected)) {
    if (typeof actual !== "number") {
      return {
        status: "error",
        message: `numeric assertion expected number, got ${typeof actual}`,
      };
    }

    if (typeof expected.minimum === "number" && actual < expected.minimum) {
      failures.push(`expected minimum ${expected.minimum}`);
    }

    if (typeof expected.maximum === "number" && actual > expected.maximum) {
      failures.push(`expected maximum ${expected.maximum}`);
    }

    if (typeof expected.exclusiveMinimum === "number" && actual <= expected.exclusiveMinimum) {
      failures.push(`expected exclusiveMinimum ${expected.exclusiveMinimum}`);
    }

    if (typeof expected.exclusiveMaximum === "number" && actual >= expected.exclusiveMaximum) {
      failures.push(`expected exclusiveMaximum ${expected.exclusiveMaximum}`);
    }

    if (typeof expected.multipleOf === "number" && actual % expected.multipleOf !== 0) {
      failures.push(`expected multipleOf ${expected.multipleOf}`);
    }
  }

  // A list is checked for membership, not for equality: a requirement says the
  // account is in `sudo`, and which other groups it is in is not the question.
  if ("contains" in expected) {
    if (!Array.isArray(actual)) {
      return {
        status: "error",
        message: `contains assertion expected a list, got ${typeof actual}`,
      };
    }

    if (!actual.some((value) => isDeepStrictEqual(value, expected.contains))) {
      failures.push(`expected contains ${formatValue(expected.contains)}`);
    }
  }

  const stringKeys = ["minLength", "maxLength", "pattern"];
  if (stringKeys.some((key) => key in expected)) {
    if (typeof actual !== "string") {
      return {
        status: "error",
        message: `string assertion expected string, got ${typeof actual}`,
      };
    }

    if (typeof expected.minLength === "number" && actual.length < expected.minLength) {
      failures.push(`expected minLength ${expected.minLength}`);
    }

    if (typeof expected.maxLength === "number" && actual.length > expected.maxLength) {
      failures.push(`expected maxLength ${expected.maxLength}`);
    }

    if (typeof expected.pattern === "string" && !new RegExp(expected.pattern).test(actual)) {
      failures.push(`expected pattern ${expected.pattern}`);
    }
  }

  return failures.length === 0
    ? { status: "passed" }
    : { status: "failed", message: failures.join("; ") };
}

function leaf(status: CheckStatus, expected: unknown, actual: unknown, message: string): RequirementLeafCheck {
  return {
    status,
    expected: {
      passed: status === "passed" ? true : status === "failed" ? false : null,
      value: expected,
    },
    actual,
    details: {
      message,
    },
  };
}

function buildLeafChecks(expected: unknown, status: CheckStatus, message: string): RequirementCheckNode {
  if (isRecord(expected) && !isAssertionObject(expected)) {
    return Object.fromEntries(
      Object.entries(expected).map(([key, value]) => [key, buildLeafChecks(value, status, message)]),
    );
  }

  return {
    status,
    expected: status === "skipped" ? null : {
      passed: status === "passed" ? true : status === "failed" ? false : null,
      value: expected,
    },
    actual: null,
    details: {
      message,
    },
  };
}

function aggregateCheckNode(node: RequirementCheckNode): CheckStatus {
  if (isLeafCheck(node)) {
    return node.status;
  }

  return aggregateStatuses(Object.values(node).map(aggregateCheckNode));
}

function aggregateStatuses(statuses: readonly CheckStatus[]): CheckStatus {
  if (statuses.length === 0) {
    return "skipped";
  }

  if (statuses.every((status) => status === "skipped")) {
    return "skipped";
  }

  if (statuses.includes("error")) {
    return "error";
  }

  if (statuses.includes("failed")) {
    return "failed";
  }

  return "passed";
}

function extractCheckBlocks(requirement: TargetlessRequirement): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(requirement).filter(([key]) => !requirementMetaFields.has(key)),
  );
}

function byTarget(snapshots: readonly FactSnapshot[]): Map<string, FactSnapshot> {
  const index = new Map<string, FactSnapshot>();

  for (const snapshot of snapshots) {
    index.set(snapshot.target.id, snapshot);
  }

  return index;
}

function isAssertionObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).some((key) => assertionKeys.has(key));
}

function asObserved(value: unknown): Observed | undefined {
  if (!isRecord(value) || typeof value.status !== "string") {
    return undefined;
  }

  if (!["present", "absent", "unknown", "unsupported", "error"].includes(value.status)) {
    return undefined;
  }

  return value as Observed;
}

function isLeafCheck(value: RequirementCheckNode): value is RequirementLeafCheck {
  return isRecord(value) && typeof value.status === "string" && "expected" in value && "actual" in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatValue(value: unknown): string {
  return JSON.stringify(value);
}

function stableId(prefix: string, timestamp: string): string {
  return `${prefix}_${timestamp.replace(/[^0-9A-Za-z]/g, "")}`;
}

function summarizeResults(results: readonly RequirementResult[]): string {
  return results
    .filter((result) => result.status !== "passed")
    .map((result) => `${result.requirementId}: ${result.status}`)
    .join("; ");
}
