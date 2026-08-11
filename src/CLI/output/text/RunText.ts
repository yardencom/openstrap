import type {
  RequirementCheckNode,
  RequirementLeafCheck,
} from "../../../Modules/Requirements/index.js";
import type { RunResult } from "../../application/RunCommand.js";
import type { CommandText } from "../types.js";

/** What a run found, and what it looked at to find it. */
export class RunText implements CommandText<RunResult> {
  print(result: RunResult): string {
    const lines: string[] = [];

    lines.push(`OpenStrap run: ${result.requirementRun.status}`);
    lines.push("");
    lines.push("Targets:");

    for (const snapshot of result.snapshots) {
      lines.push(
        `  - ${snapshot.target.id} (${snapshot.scope}/${snapshot.target.type}) snapshot=${snapshot.id}`,
      );
    }

    lines.push("");
    lines.push(...this.requirements(result.requirementRun));
    lines.push("");

    return `${lines.join("\n")}\n`;
  }

  /** How a machine measured up. */
  requirements(run: RunResult["requirementRun"]): string[] {
    const lines = ["Requirements:"];

    for (const requirement of run.results) {
      const checks = this.leaves(requirement.checks);
      const passed = checks.filter((leaf) => leaf.check.status === "passed").length;

      lines.push(
        `  - ${requirement.requirementId} [${requirement.target}]: ${requirement.status}` +
        ` (${passed}/${checks.length} checks passed)`,
      );

      if (passed === checks.length) {
        continue;
      }

      for (const leaf of checks) {
        lines.push(
          `      ${leaf.path}: ${leaf.check.status}; expected=${JSON.stringify(leaf.check.expected?.value ?? null)} ` +
          `actual=${JSON.stringify(leaf.check.actual)}${leaf.check.details?.message ? `; ${leaf.check.details.message}` : ""}`,
        );
      }
    }

    return lines;
  }

  /** Every leaf of a check tree, named by the path that reaches it: the tree carries no names. */
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
