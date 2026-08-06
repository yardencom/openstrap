import { isLeafCheck } from "#types/Requirements.js";
import type { CheckStatus, RequirementCheckNode, RequirementLeafCheck } from "#types/Requirements.js";

/**
 * What a set of checks comes to, taken together.
 *
 * The order matters and is the whole of the rule: an error outranks a failure, because a check that
 * could not be made says nothing about whether the machine complies, and reporting it as a failure
 * would be reporting an answer nobody has. A failure outranks a pass. Nothing but skips is a skip —
 * a requirement that asked for nothing was not satisfied, it was not asked.
 */
export class CheckOutcome {
  /** A tree of checks, as one status. */
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
    return isLeafCheck(node);
  }
}
