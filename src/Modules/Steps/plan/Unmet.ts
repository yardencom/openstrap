import { Checks } from "#types/Requirements.js";
import type { RequirementCheckNode, RequirementResult, RequirementRun } from "#types/Requirements.js";
import type { Unsatisfied } from "#types/Unsatisfied.js";

/** What a machine was required to be and is not. */
export class Unmet {
  /** Every failed comparison in a run, whichever requirement or target it belongs to. */
  static in(run: RequirementRun): readonly Unsatisfied[] {
    return run.results.flatMap((result) => Unmet.ofOne(result));
  }

  static ofOne(result: RequirementResult): readonly Unsatisfied[] {
    return Unmet.walk(result.checks, [], result.requirementId);
  }

  private static walk(
    node: RequirementCheckNode,
    path: readonly string[],
    requirementId: string,
  ): readonly Unsatisfied[] {
    if (!Checks.isLeaf(node)) {
      return Object.entries(node).flatMap(([key, child]) => Unmet.walk(child, [...path, key], requirementId));
    }

    if (node.status !== "failed") {
      return [];
    }

    return [{
      requirementId,
      path: path.join("."),
      // What the requirement asked for, not the envelope the result wraps it in. A caller wanting to
      // report "expected present, got absent" should not have to know about `expected.value`.
      expected: node.expected?.value,
      actual: node.actual,
      message: node.details?.message,
    }];
  }
}
