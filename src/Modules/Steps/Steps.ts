import { Applying, type Reveal } from "./apply/Applying.js";
import { DeclaredSteps } from "./plan/DeclaredSteps.js";
import { Planning } from "./plan/Planning.js";
import { Unmet } from "./plan/Unmet.js";
import type { FactSections } from "#types/Facts.js";
import type { Immutable } from "#types/Immutable.js";
import type { Plan } from "#types/Plan.js";
import type { RequirementRun } from "#types/Requirements.js";
import type { Resolver } from "#types/Unsatisfied.js";
import type { Step, StepOutcome } from "#types/Step.js";

export { DeclaredSteps } from "./plan/DeclaredSteps.js";
export type { Action, FileAccess, StepValue } from "#types/Action.js";
export type { Reveal } from "./apply/Applying.js";
export type { Plan } from "#types/Plan.js";
export type { Resolver, Unsatisfied } from "#types/Unsatisfied.js";
export type { Guard, Step, StepOutcome, StepStatus } from "#types/Step.js";

/**
 * What to do about a machine that fell short, and doing it.
 *
 * It does not read machines, does not compare, and does not decide when to stop — those are the other
 * three stages, and a loop over them is a feature. And it knows nothing about any machine: not one
 * program, not one operating system. A test greps this directory for their names.
 */
export class Steps {
  constructor(
    private readonly resolvers: readonly Resolver[] = [],
    private readonly applying = new Applying(),
  ) {}

  /** What is not true, and what would be done about it. */
  plan(run: RequirementRun, facts: Immutable<FactSections>): Plan {
    return new Planning(this.resolvers).of(Unmet.in(run), facts);
  }

  /** Doing it. Every step is attempted; a failure is reported rather than thrown. */
  apply(steps: readonly Step[]): Promise<readonly StepOutcome[]> {
    return this.applying.execute(steps);
  }

  /** The same module, told about the steps a blueprint declared and where secrets come from. */
  static declared(steps: readonly Step[], resolvers: readonly Resolver[] = [], reveal?: Reveal): Steps {
    return new Steps(
      steps.length === 0 ? resolvers : [new DeclaredSteps(steps), ...resolvers],
      new Applying(reveal),
    );
  }
}
