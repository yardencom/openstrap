import { Checks } from "#types/Requirements.js";
import type { CheckStatus, RequirementCheckNode, RequirementLeafCheck } from "#types/Requirements.js";

/** What a set of checks comes to, taken together. */
export class CheckOutcome {
  static of(node: RequirementCheckNode): CheckStatus {
    return CheckOutcome.isLeaf(node)
      ? node.status
      : CheckOutcome.ofAll(Object.values(node).map(CheckOutcome.of));
  }

  static ofAll(statuses: readonly CheckStatus[]): CheckStatus {
    if (statuses.length === 0 || statuses.every((status) => status === "skipped")) {
      return "skipped";
    }

    if (statuses.includes("error")) {
      return "error";
    }

    return statuses.includes("failed") ? "failed" : "passed";
  }

  /** A node that holds a comparison rather than more nodes. Said once, in the vocabulary. */
  static isLeaf(node: RequirementCheckNode): node is RequirementLeafCheck {
    return Checks.isLeaf(node);
  }
}
