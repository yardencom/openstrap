import { isDeepStrictEqual } from "node:util";

import { satisfies, valid, validRange } from "semver";

import type { FactCollection, FactCollectionItem, Observed, ObservedStatus } from "../../FactsRuntime/index.js";
import type {
  CheckStatus,
  Requirement,
  RequirementCheckNode,
  RequirementLeafCheck,
  RequirementResult,
  RequirementRun,
  RequirementTarget,
} from "../Domain/Requirements.js";

const requirementMetaFields = new Set(["id", "target", "optional"]);
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
]);
const terminalObservedStatuses = new Set<ObservedStatus>(["unknown", "unsupported", "error"]);

export class RequirementEvaluator {
  evaluate(params: {
    requirements: readonly Requirement[];
    targets: readonly RequirementTarget[];
    factCollection: FactCollection;
    now?: Date;
    attempt?: number;
    trigger?: string;
    profile?: string;
    purpose?: string;
  }): RequirementRun {
    const startedAt = params.now ?? new Date();
    const finishedAt = new Date(startedAt.getTime());
    const snapshotsByTarget = indexFactsByTarget(params.factCollection);
    const results = params.requirements.map((requirement) =>
      this.evaluateRequirement(requirement, snapshotsByTarget.get(requirement.target)),
    );
    const status = aggregateStatuses(results.map((result) => result.status));

    return {
      id: stableId("req_run", startedAt.toISOString()),
      status,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      attempt: params.attempt ?? 1,
      trigger: params.trigger ?? "manual",
      profile: params.profile ?? "local-vm-preflight",
      purpose: params.purpose ?? "preflight",
      targets: Object.fromEntries(params.targets.map((target) => [target.name, target.name])),
      results,
      details: status === "passed" ? undefined : {
        message: summarizeResults(results),
      },
    };
  }

  private evaluateRequirement(
    requirement: Requirement,
    factItem: FactCollectionItem | undefined,
  ): RequirementResult {
    const checkBlocks = extractCheckBlocks(requirement);

    if (!factItem) {
      const checks = buildLeafChecks(checkBlocks, "error", "No FactSnapshot was collected for requirement target");

      return {
        requirementId: requirement.id,
        target: requirement.target,
        facts: {
          snapshotId: null,
          factRunId: null,
        },
        status: "error",
        checks,
      };
    }

    const checks = evaluateNode({
      expected: checkBlocks,
      actual: factItem.snapshot.data,
      path: [],
      observedAncestor: undefined,
    });

    return {
      requirementId: requirement.id,
      target: requirement.target,
      facts: {
        snapshotId: factItem.snapshot.id,
        factRunId: factItem.run.id,
      },
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

function extractCheckBlocks(requirement: Requirement): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(requirement).filter(([key]) => !requirementMetaFields.has(key)),
  );
}

function indexFactsByTarget(collection: FactCollection): Map<string, FactCollectionItem> {
  const index = new Map<string, FactCollectionItem>();

  for (const item of collection) {
    index.set(item.snapshot.target.id, item);
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
