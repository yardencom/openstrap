import type { Resolver, Unsatisfied } from "#types/Unsatisfied.js";
import type { Step } from "#types/Step.js";

/** Steps a person wrote down, as a resolver. */
export class DeclaredSteps implements Resolver {
  readonly id = "declared";

  constructor(private readonly steps: readonly Step[]) {}

  resolve(unsatisfied: Unsatisfied): readonly Step[] | undefined {
    const answering = this.steps.filter((step) =>
      (step.requirements ?? []).includes(unsatisfied.requirementId),
    );

    return answering.length === 0 ? undefined : answering;
  }
}
