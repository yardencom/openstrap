export type CheckStatus = "passed" | "failed" | "error" | "skipped";

/**
 * Whether a run of this status means the thing it checked is fit for use.
 *
 * `skipped` counts as success: nothing was required, so nothing was found wanting.
 * A run that never happened — no requirements at all — counts the same way, which is
 * why the status may be absent.
 */
export function runSucceeded(status: CheckStatus | undefined): boolean {
  return status === undefined || status === "passed" || status === "skipped";
}

export type TargetlessRequirement = {
  id: string;
  optional?: boolean;
} & Record<string, unknown>;

export type RequirementTarget = {
  name: string;
  type: string;
};

export type RequirementExpected =
  | {
      passed: boolean | null;
      value: unknown;
    }
  | null;

export type RequirementLeafCheck = {
  status: CheckStatus;
  expected: RequirementExpected;
  actual: unknown;
  details?: {
    message?: string;
  };
};

export type RequirementCheckNode = RequirementLeafCheck | {
  [key: string]: RequirementCheckNode;
};

export type RequirementResult = {
  requirementId: string;
  target: string;
  facts: {
    snapshotId: string | null;
    factRunId: string | null;
  };
  status: CheckStatus;
  checks: RequirementCheckNode;
};

export type RequirementRun = {
  id: string;
  status: CheckStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  attempt: number;
  trigger: string;
  profile: string;
  purpose: string;
  targets: Record<string, string>;
  results: RequirementResult[];
  details?: {
    message?: string;
  };
};
