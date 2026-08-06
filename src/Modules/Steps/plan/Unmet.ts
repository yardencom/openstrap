import { isLeafCheck } from "#types/Requirements.js";
import type { RequirementCheckNode, RequirementResult, RequirementRun } from "#types/Requirements.js";
import type { Unsatisfied } from "#types/Unsatisfied.js";

/**
 * What a machine was required to be and is not.
 *
 * The whole of this class is taking a tree apart, and that is the point: openstrap already knows
 * what is wrong. It read the machine, it walked the requirement beside the reading, and it wrote
 * down every comparison with its expected and its actual. Converging does not get to have an opinion
 * about any of that — it gets the same answer, flat, and starts from there.
 *
 * Every other tool in this business has to implement reading before it can converge, because it has
 * no facts to begin from. Terraform's providers each write their own `Read`; Chef's resources each
 * write their own `load_current_resource`. Here that half already exists and belongs to somebody
 * else, so this file is thirty lines.
 *
 * Only `failed` is taken. `error` means the machine could not be read at that point, and a reading
 * that did not happen is not a machine that fell short: the thing to fix is the reading. Acting on
 * one would be openstrap running commands on a machine it just admitted it cannot see.
 */
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
    if (!isLeafCheck(node)) {
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
