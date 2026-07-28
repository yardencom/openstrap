import type {
  RequirementCheckNode,
  RequirementLeafCheck,
} from "../../../Modules/Requirements/index.js";
import type { RunResult } from "../../application/RunCommand.js";
import type { CommandText } from "../types.js";

/**
 * What a run found, and only what went wrong.
 *
 * A passing check needs no line: the run's own status already says everything passed, and
 * a hundred lines saying so would bury the one that did not.
 */
export class RunText implements CommandText<RunResult> {
  print(result: RunResult): string {
    const lines: string[] = [];

    lines.push(`OpenStrap run: ${result.requirementRun.status}`);
    lines.push("");
    lines.push("Targets:");

    for (const item of result.facts) {
      lines.push(
        `  - ${item.snapshot.target.id} (${item.snapshot.scope}/${item.snapshot.target.type}) ` +
        `snapshot=${item.snapshot.id} factRun=${item.run.id}`,
      );
    }

    lines.push("");
    lines.push("Requirements:");

    for (const requirement of result.requirementRun.results) {
      lines.push(`  - ${requirement.requirementId} [${requirement.target}]: ${requirement.status}`);

      for (const leaf of this.leaves(requirement.checks)) {
        if (leaf.check.status === "passed") {
          continue;
        }

        lines.push(
          `      ${leaf.path}: ${leaf.check.status}; expected=${JSON.stringify(leaf.check.expected?.value ?? null)} ` +
          `actual=${JSON.stringify(leaf.check.actual)}${leaf.check.details?.message ? `; ${leaf.check.details.message}` : ""}`,
        );
      }
    }

    lines.push("");

    return `${lines.join("\n")}\n`;
  }

  /**
   * Every leaf of a check tree, named by the path that reaches it.
   *
   * A requirement about `cpu.cores.minimum` fails at a leaf, and a reader needs to know
   * which leaf — the tree itself carries no names.
   */
  private leaves(node: RequirementCheckNode, path: readonly string[] = []): Array<{
    path: string;
    check: RequirementLeafCheck;
  }> {
    if (this.isLeaf(node)) {
      return [{ path: path.join("."), check: node }];
    }

    return Object.entries(node).flatMap(([key, value]) => this.leaves(value, [...path, key]));
  }

  private isLeaf(value: RequirementCheckNode): value is RequirementLeafCheck {
    return Boolean(
      value &&
      typeof value === "object" &&
      "status" in value &&
      "expected" in value &&
      "actual" in value,
    );
  }
}
