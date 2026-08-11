import type { Action } from "#types/Action.js";
import type { CommandText } from "../types.js";
import type { ConvergeResult } from "../../application/ConvergeCommand.js";
import type { Plan } from "../../../Modules/Steps/index.js";
import { RunText } from "./RunText.js";

/** Why the loop stopped, said to a person rather than to a program. */
const endings: Record<ConvergeResult["end"], string> = {
  satisfied: "the machine is what the blueprint declares",
  checked: "nothing was changed; this is what would be done",
  stalled: "a pass changed nothing, so another would do the same again",
  unresolved: "nothing left knows how to make the rest true",
  exhausted: "the limit of passes was reached with work still to do",
};

/** What converging did, and what the machine is now. */
export class ConvergeText implements CommandText<ConvergeResult> {
  constructor(private readonly requirements = new RunText()) {}

  print(result: ConvergeResult): string {
    const lines: string[] = [];

    lines.push(`OpenStrap converge: ${result.end} — ${endings[result.end]}`);
    lines.push("");

    if (result.passes.length === 0) {
      lines.push(result.end === "checked" ? "Nothing was run." : "Nothing was run: no step was left to run.");
    }

    for (const pass of result.passes) {
      lines.push(`Pass ${pass.number} (${pass.unsatisfied} not yet true):`);

      for (const step of pass.applied) {
        lines.push(`  - ${step.stepId}: ${step.status}${step.message ? ` — ${step.message}` : ""}`);
      }
    }

    lines.push("");
    lines.push(...this.plan(result.plan, result.end));
    lines.push(`Read: ${result.snapshot.id}`);
    lines.push("");
    lines.push(...this.requirements.requirements(result.requirementRun));
    lines.push("");

    return `${lines.join("\n")}\n`;
  }

  /** The plan as it stands at the end: the whole point after `--check`, what is still not true after a run. */
  private plan(plan: Plan, end: ConvergeResult["end"]): string[] {
    const lines: string[] = [];

    if (end === "checked" && plan.steps.length > 0) {
      lines.push("Would run:");

      for (const step of plan.steps) {
        lines.push(`  - ${step.id}: ${ConvergeText.said(step.action)}`);
        lines.push(`      for ${(step.requirements ?? []).join(", ")}`);
      }

      lines.push("");
    }

    if (plan.unresolved.length > 0) {
      lines.push("Nothing knows how to make these true:");

      for (const one of plan.unresolved) {
        lines.push(`  - ${one.path} [${one.requirementId}]: ${one.message ?? "not satisfied"}`);
      }

      lines.push("");
    }

    return lines;
  }

  /** One action, in one line, close enough to what it does that a reader can object to it. */
  private static said(action: Action): string {
    switch (action.kind) {
      case "run":
        return action.shell
          ? `run ${action.args[1] ?? ""}`
          : `run ${action.command} ${action.args.join(" ")}`.trimEnd();
      case "write":
        return `write ${action.path}`;
      case "remove":
        return `remove ${action.path}`;
      case "download":
        return `download ${action.url} to ${action.path}`;
    }
  }

}
