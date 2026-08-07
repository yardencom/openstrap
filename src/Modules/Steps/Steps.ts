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
 * The way into this module and the only one. Two questions, and they are deliberately two: what
 * would be done, and doing it. `--check` is the first without the second, and a thing that could
 * only answer both at once could not be asked to explain itself before it ran.
 *
 * What this module does not do is as much of its design as what it does. It does not read machines —
 * facts do that. It does not compare — requirements do that. It does not decide when to stop, or
 * whether it worked; that is a loop over all three, and a loop over three modules is a feature, not
 * a module. What is left is small on purpose: take a comparison apart, ask who knows what to do, do
 * it.
 *
 * And it knows nothing about any machine: not one program, not one way of starting things, not one
 * operating system, not one product. Every one of those lives in a resolver — in a plugin, or
 * written by hand in a blueprint — and the rule is kept by a test that greps this directory for
 * their names rather than by anyone remembering. That is what makes it an engine rather than a
 * catalogue: it can be pointed at anything, because it has never heard of anything.
 */
export class Steps {
  constructor(
    private readonly resolvers: readonly Resolver[] = [],
    private readonly applying = new Applying(),
  ) {}

  /**
   * What is not true, and what would be done about it.
   *
   * The run goes in whole rather than a list of failures, because taking the failures out of it is
   * this module's job and a caller doing it by hand is a caller with its own idea of which statuses
   * mean the machine fell short.
   */
  plan(run: RequirementRun, facts: Immutable<FactSections>): Plan {
    return new Planning(this.resolvers).of(Unmet.in(run), facts);
  }

  /** Doing it. Every step is attempted; a failure is reported rather than thrown. */
  apply(steps: readonly Step[]): Promise<readonly StepOutcome[]> {
    return this.applying.execute(steps);
  }

  /**
   * The same module, told about the steps a blueprint declared and where secrets come from.
   *
   * @param reveal What answers a name a step wrote instead of a value. Handed in, because which
   * store an installation has is not this module's business — a keychain here, something else
   * elsewhere, and the blueprint says neither.
   */
  static declared(steps: readonly Step[], resolvers: readonly Resolver[] = [], reveal?: Reveal): Steps {
    return new Steps(
      steps.length === 0 ? resolvers : [new DeclaredSteps(steps), ...resolvers],
      new Applying(reveal),
    );
  }
}
