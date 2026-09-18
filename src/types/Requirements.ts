export type CheckStatus = "passed" | "failed" | "error" | "skipped";

/** How one comparison came out, and what to say about it when it did not pass. */
export type Comparisons = {
  status: CheckStatus;
  message?: string;
};


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
  /** When the requirements were checked. */
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

/** The two questions asked of a check that its shape cannot answer. */
export class Checks {
  /** Whether a run of this status means the thing it checked is fit for use. */
  static succeeded(status: CheckStatus | undefined): boolean {
    return status === undefined || status === "passed" || status === "skipped";
  }

  /** A node that holds a comparison rather than more nodes. */
  static isLeaf(node: RequirementCheckNode): node is RequirementLeafCheck {
    return Boolean(node)
      && typeof node === "object"
      && typeof (node as RequirementLeafCheck).status === "string"
      && "expected" in node
      && "actual" in node;
  }
}
