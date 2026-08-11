import { StepSecrets } from "./StepSecrets.js";
import { Steps } from "../../../Modules/Steps/index.js";
import { Facts, type FactSnapshot } from "../../../Modules/Facts/Facts.js";
import { Requirements } from "../../../Modules/Requirements/index.js";
import type { Convergence, ConvergenceEnd, ConvergencePass } from "#types/Convergence.js";
import type { Plan } from "#types/Plan.js";
import type { Resolver } from "#types/Unsatisfied.js";
import type { Step } from "#types/Step.js";
import type { Target } from "#types/Target.js";
import type { TargetlessRequirement } from "#types/Requirements.js";

export type ConvergingRequest = {
  /** The machine this is about, which is the machine this is running on. */
  target: Target;
  requirements: readonly TargetlessRequirement[];
  steps?: readonly Step[];
  /** Steps anything else knows how to produce: plugins, in the order they were loaded. */
  resolvers?: readonly Resolver[];
  /** How many times to act before giving up. Three, unless somebody has a reason. */
  maxPasses?: number;
  /** Work out the plan, print it, change nothing. */
  check?: boolean;
  now?: Date;
};

export type ConvergingResult = Convergence & {
  /** The machine as it was read last, which is the reading the proof was judged against. */
  snapshot: FactSnapshot;
};

/**
 * The loop, on the machine it is running on.
 *
 * Every pass reads the machine afresh and plans against what is still wrong, so a step whose
 * requirement now passes is not planned again. That is also the whole of the ordering: a step that
 * failed because its turn had not come is retried by the next pass, which costs one reading per link
 * of the chain and buys the absence of a dependency graph.
 *
 * The answer is a requirement run taken after the last action, not the exit codes of steps.
 */
export class Converging {
  constructor(private readonly secrets = new StepSecrets()) {}

  async execute(request: ConvergingRequest): Promise<ConvergingResult> {
    const steps = request.steps ?? [];
    const requirements = new Requirements(request.requirements);
    const steps_ = Steps.declared(steps, request.resolvers ?? [], this.secrets.reveal());
    const maxPasses = request.maxPasses ?? 3;
    const passes: ConvergencePass[] = [];

    // What has to be read: everything the requirements are about, and everything the guards are
    // about. A guard asking after a section nobody required would otherwise be checked against a
    // reading that never looked, and would never be true.
    const asked = new Requirements([...request.requirements, ...Converging.guardsOf(steps)]).order();
    let stalled = false;

    for (let pass = 1; ; pass += 1) {
      const snapshot = await Facts.collect({ target: request.target, declare: asked, now: request.now });
      const requirementRun = requirements.checkedAgainst({
        target: request.target,
        snapshots: [snapshot],
        attempt: pass,
        trigger: "converge",
        purpose: "converge",
        now: request.now,
      });
      const plan = steps_.plan(requirementRun, snapshot.facts);
      const done = (end: ConvergenceEnd): ConvergingResult =>
        ({ passes, plan, unresolved: plan.unresolved, end, requirementRun, snapshot });

      if (plan.unsatisfied.length === 0) {
        return done("satisfied");
      }

      if (request.check) {
        return done("checked");
      }

      if (stalled) {
        return done("stalled");
      }

      if (pass > maxPasses) {
        return done("exhausted");
      }

      const todo = this.todo(plan, snapshot, request.target);

      if (todo.length === 0) {
        return done("unresolved");
      }

      const applied = await steps_.apply(todo);

      passes.push({ number: pass, unsatisfied: plan.unsatisfied.length, applied });
      stalled = !applied.some((outcome) => outcome.status === "done");
    }
  }

  /** The steps of this plan that are still worth running. */
  private todo(plan: Plan, snapshot: FactSnapshot, target: Target): readonly Step[] {
    return plan.steps.filter((step) => {
      if (step.guard === undefined) {
        return true;
      }

      const guard = new Requirements([Converging.asRequirement(step)]).checkedAgainst({ target, snapshots: [snapshot] });

      return guard.status !== "passed";
    });
  }

  private static asRequirement(step: Step): TargetlessRequirement {
    return { id: `${step.id}:guard`, ...step.guard };
  }

  private static guardsOf(steps: readonly Step[]): readonly TargetlessRequirement[] {
    return steps.filter((step) => step.guard !== undefined).map(Converging.asRequirement);
  }
}

/** A step's guard as something the requirement machinery can check: a requirement named after it. */
