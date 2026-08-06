import type { Action } from "#types/Action.js";
import type { BlueprintTargetConfig, WrittenStep } from "./schema/BlueprintConfig.js";
import type { Step } from "#types/Step.js";
import type { TargetlessRequirement } from "../Requirements/index.js";

/**
 * The steps of a target, as the rest of openstrap needs them.
 *
 * Two things happen here, and both are why the loader exists at all.
 *
 * The first is the action. A person writes `run: curl … | sh -`; openstrap carries a tagged union
 * whose `run` is a program and its arguments. A shell line becomes `sh -c` and the line, marked as
 * having been written as one so the plan prints back in the words it was written in.
 *
 * The second is what the step is for. A step written inside a requirement is for that requirement,
 * and the connection is where it sits — nothing is written and nothing can be mistyped. A step
 * written beside them names the requirements it is for, because it is for more than one and cannot
 * sit in both.
 *
 * The steps come out; the requirements go on without them. What reaches the checker is a
 * requirement, and a requirement is a statement about a machine — `steps` sitting in it would be
 * read as a section of facts nobody collected.
 */
export class WrittenSteps {
  constructor(private readonly target: BlueprintTargetConfig) {}

  /** The requirements with their steps taken out. */
  requirements(): TargetlessRequirement[] {
    return (this.target.requirements ?? []).map(({ steps, ...requirement }) => {
      void steps;

      return requirement;
    });
  }

  /**
   * Steps back in the words they were written in.
   *
   * The inverse, and it exists because a blueprint travels. openstrap delivers itself to a machine
   * it is not on and leaves a blueprint under its feet, and the openstrap over there reads that file
   * with this same loader against this same schema — so what is sent has to be a document a person
   * could have written. A step in the shape a plan is made of is not one, and the far side is right
   * to refuse it.
   *
   * Everything comes back beside the requirements rather than inside them, so everything names what
   * it is for. That is a shape a person would not write for a single-requirement step, and it means
   * the same thing: `for` is where a step says what it makes true when where it sits cannot.
   */
  static asWritten(steps: readonly Step[]): WrittenStep[] {
    return steps.map((step) => ({
      id: step.id,
      ...(step.requirements === undefined ? {} : { for: [...step.requirements] }),
      ...(step.guard === undefined ? {} : { guard: step.guard }),
      ...asWrittenAction(step.action),
    }));
  }

  /** Every step of this target: the ones inside requirements, then the ones beside them. */
  steps(): Step[] {
    const inside = (this.target.requirements ?? []).flatMap((requirement) =>
      (requirement.steps ?? []).map((written) => step(written, [requirement.id])),
    );
    const beside = (this.target.steps ?? []).map((written) => step(written, written.for ?? []));

    return [...inside, ...beside];
  }
}

function step(written: WrittenStep, requirements: readonly string[]): Step {
  return {
    id: written.id,
    requirements,
    ...(written.guard === undefined ? {} : { guard: written.guard }),
    action: actionOf(written),
  };
}

/**
 * The one thing this step does.
 *
 * Which one it is has already been settled — the schema refuses a step that writes none or two — so
 * this reads the first it finds rather than asking again in a second place that could disagree.
 */
function actionOf(written: WrittenStep): Action {
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

/**
 * One action, back in the words it was written in.
 *
 * `shell` is what makes this possible: a shell line and a program with two arguments both arrive
 * here as `sh -c …`, and only the step that was written as a line may go back as one.
 */
function asWrittenAction(action: Action): Partial<WrittenStep> {
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
