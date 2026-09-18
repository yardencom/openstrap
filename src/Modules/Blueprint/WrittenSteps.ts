import type { Action } from "#types/Action.js";
import type { BlueprintTargetConfig, WrittenStep } from "./schema/BlueprintConfig.js";
import type { Step } from "#types/Step.js";
import type { TargetlessRequirement } from "../Requirements/index.js";

/** The steps of a target, as the rest of openstrap needs them. */
export class WrittenSteps {
  constructor(private readonly target: BlueprintTargetConfig) {}

  requirements(): TargetlessRequirement[] {
    return (this.target.requirements ?? []).map(({ steps, ...requirement }) => {
      void steps;

      return requirement;
    });
  }

  /** Steps back in the words they were written in. */
  static asWritten(steps: readonly Step[]): WrittenStep[] {
    return steps.map((step) => ({
      id: step.id,
      ...(step.requirements === undefined ? {} : { for: [...step.requirements] }),
      ...(step.guard === undefined ? {} : { guard: step.guard }),
      ...WrittenSteps.asWrittenAction(step.action),
    }));
  }

  /** Every step of this target: the ones inside requirements, then the ones beside them. */
  steps(): Step[] {
    const inside = (this.target.requirements ?? []).flatMap((requirement) =>
      (requirement.steps ?? []).map((written) => WrittenSteps.step(written, [requirement.id])),
    );
    const beside = (this.target.steps ?? []).map((written) => WrittenSteps.step(written, written.for ?? []));

    return [...inside, ...beside];
  }

  private static step(written: WrittenStep, requirements: readonly string[]): Step {
    return {
      id: written.id,
      requirements,
      ...(written.guard === undefined ? {} : { guard: written.guard }),
      action: WrittenSteps.actionOf(written),
    };
  }

  /** The one thing this step does. */
  private static actionOf(written: WrittenStep): Action {
    const where = { cwd: written.cwd, environment: written.environment, timeoutMs: written.timeoutMs };

    if (written.run !== undefined) {
      // A shell line is a shell line. Somebody has to write `sh -c`, and having the person write it is
      // having them write it wrong once in a while.
      return { kind: "run", command: "sh", args: ["-c", written.run], shell: true, ...where };
    }

    if (written.exec !== undefined) {
      return { kind: "run", command: written.exec[0]!, args: written.exec.slice(1), ...where };
    }

    if (written.write !== undefined) {
      return { kind: "write", ...written.write };
    }

    if (written.remove !== undefined) {
      return { kind: "remove", ...written.remove };
    }

    return { kind: "download", ...written.download! };
  }

  /** One action, back in the words it was written in. */
  private static asWrittenAction(action: Action): Partial<WrittenStep> {
    switch (action.kind) {
      case "run":
        return {
          ...(action.shell ? { run: action.args[1] ?? "" } : { exec: [action.command, ...action.args] }),
          ...(action.cwd === undefined ? {} : { cwd: action.cwd }),
          ...(action.environment === undefined ? {} : { environment: { ...action.environment } }),
          ...(action.timeoutMs === undefined ? {} : { timeoutMs: action.timeoutMs }),
        };
      case "write":
        return { write: { path: action.path, content: action.content, ...(action.access ? { access: action.access } : {}) } };
      case "remove":
        return { remove: { path: action.path, ...(action.recursive === undefined ? {} : { recursive: action.recursive }) } };
      case "download":
        return { download: { url: action.url, path: action.path, ...(action.access ? { access: action.access } : {}) } };
    }
  }
}
