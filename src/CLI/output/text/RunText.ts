import type {
  RequirementCheckNode,
  RequirementLeafCheck,
} from "../../../Modules/Requirements/index.js";
import type { RunResult } from "../../application/RunCommand.js";
import type { CommandText } from "../types.js";

/**
 * What a run found, and what it looked at to find it.
 *
 * Passing checks used to be left out entirely, on the argument that a hundred lines saying "fine"
 * would bury the one line that is not. The cost was worse than the noise: reading
 * `machine-fits-a-cluster: failed / memory…` there was no way to tell whether the processor had been
 * looked at, and for a tool whose whole claim is facts as proof, silence about what was proven is
 * the wrong economy. `passed` and `skipped` were also indistinguishable — both were nothing — though
 * one means "checked, it holds" and the other "there was nothing to check".
 *
 * So every requirement says how it went and how many of its checks did, and the checks themselves are
 * listed when any of them did not pass. A requirement that passed entirely is one line; a requirement
 * that failed shows all of its checks, passing ones included, because what else was looked at is
 * exactly what a reader wants next.
 */
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
    lines.push("Requirements:");

    for (const requirement of result.requirementRun.results) {
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
