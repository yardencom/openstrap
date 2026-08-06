export type CheckStatus = "passed" | "failed" | "error" | "skipped";

/**
 * How one comparison came out, and what to say about it when it did not pass.
 *
 * The smallest unit of judging: one thing a requirement expected against one thing a machine
 * reported. Every leaf of a requirement's result is built from one of these.
 */
export type Comparisons = {
  status: CheckStatus;
  message?: string;
};

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

/**
 * A node that holds a comparison rather than more nodes.
 *
 * Here rather than beside whoever walks the tree, because more than one thing walks it: judging
 * rolls the leaves up into a status, and converging takes the failed ones apart again. Two answers
 * to "is this a leaf" would be two shapes of the same tree.
 */
export function isLeafCheck(node: RequirementCheckNode): node is RequirementLeafCheck {
  return Boolean(node)
    && typeof node === "object"
    && typeof (node as RequirementLeafCheck).status === "string"
    && "expected" in node
    && "actual" in node;
}

export type RequirementResult = {
  requirementId: string;
  target: string;
  /** Which snapshot the requirement was checked against, or nothing when none was collected. */
  snapshotId: string | null;
  status: CheckStatus;
  checks: RequirementCheckNode;
};

export type RequirementRun = {
  id: string;
  status: CheckStatus;
  /**
   * When the requirements were checked.
   *
   * One moment and not a pair: nothing is read or waited for here — the snapshots have already
   * been taken and this only compares them — so a start and a finish would be the same instant
   * written twice, which is what they were, along with a `durationMs` that was always 0.
   */
  evaluatedAt: string;
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
