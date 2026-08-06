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
  /** Steps a blueprint declared for this machine. */
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
 * The fourth stage, and the only place where the other three meet: facts read the machine,
 * requirements judge it, converging acts on it, and this decides how many times. None of the three
 * knows about the others, which is why the loop is here — a module that called two other modules
 * would be a module with an opinion about the order of the whole product.
 *
 * ## The loop, and why there is no dependency graph
 *
 * Every pass reads the machine afresh, compares, plans against what is still wrong, and acts. Steps
 * are chosen by the facts they answer, so a step whose facts now pass is simply not planned again —
 * nothing has to remember it ran, and nothing has to be marked done.
 *
 * That is also the whole of the ordering. A step that fails because its turn has not come — a
 * manifest applied to a cluster that is still starting — is not an error and does not stop the pass:
 * the next pass reads the machine, sees the cluster answering, and applies it. A chain of three
 * dependencies costs three readings, and that is the price paid instead of a dependency graph with
 * edges, cycle detection and a way to declare them. It is the price Kubernetes pays.
 *
 * It stops when the machine is right, when a pass moved nothing, when nothing left knows what to do,
 * or when the bound is reached — and it says which of the four.
 *
 * ## What "it worked" means here
 *
 * The answer is a requirement run, read from the machine after the last action. Not the exit codes
 * of the steps. Every tool in this field reports "changed", and "changed" is a statement about the
 * tool: it says a command ran, which is not the question anybody asked.
 *
 * The proof is why the loop always ends at the top, having just read. Even a pass that reported
 * nothing done gets one more reading, because a step that failed may still have changed the machine
 * on its way to failing.
 */
export class Converging {
  async execute(request: ConvergingRequest): Promise<ConvergingResult> {
    const steps = request.steps ?? [];
    const requirements = new Requirements(request.requirements);
    const steps_ = Steps.declared(steps, request.resolvers ?? []);
    const maxPasses = request.maxPasses ?? 3;
    const passes: ConvergencePass[] = [];

    // What has to be read: everything the requirements are about, and everything the guards are
    // about. A guard asking after a section nobody required would otherwise be checked against a
    // reading that never looked, and would never be true.
    const asked = new Requirements([...request.requirements, ...guardsOf(steps)]).order();
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

  /**
   * The steps of this plan that are still worth running.
   *
   * Most steps need no guard: they are in the plan because a fact they answer is not true, which is
   * the same question a guard would ask. A guard is for the rest — a step whose effect the
   * requirements do not describe, or one that must not be repeated.
   *
   * Only a guard that passes stops a step. A guard that could not be answered does not: it is not a
   * promise that the thing is there, and steps are expected to survive being run twice.
   */
  private todo(plan: Plan, snapshot: FactSnapshot, target: Target): readonly Step[] {
    return plan.steps.filter((step) => {
      if (step.guard === undefined) {
        return true;
      }

      const guard = new Requirements([asRequirement(step)]).checkedAgainst({ target, snapshots: [snapshot] });

      return guard.status !== "passed";
    });
  }
}

/** A step's guard as something the requirement machinery can check: a requirement named after it. */
function asRequirement(step: Step): TargetlessRequirement {
  return { id: `${step.id}:guard`, ...step.guard };
}

function guardsOf(steps: readonly Step[]): readonly TargetlessRequirement[] {
  return steps.filter((step) => step.guard !== undefined).map(asRequirement);
}
