import type { Resolver, Unsatisfied } from "#types/Unsatisfied.js";
import type { Step } from "#types/Step.js";

/**
 * Steps a person wrote down, as a resolver.
 *
 * The plainest way to answer "how is this made true": say so, in the blueprint, inside the
 * requirement it is about. No plugin, no registry. It is the resolver of last resort and the one
 * that always works, because a person who knows their machine can always write down what they would
 * have typed.
 *
 * It is also the one resolver that reaches a machine openstrap is not on. Plugins live where
 * openstrap was installed; the blueprint travels to the machine along with openstrap itself, and
 * steps written in it travel with it.
 *
 * Matching is by the name of the requirement that failed, and there is nothing else to it. A step
 * is for requirements — the one it sits in, or the ones it names — so every failed check of a
 * requirement is answered by the same steps, whichever part of the facts each check was about.
 * There used to be a second way, matching fact paths by prefix, and it existed only because a step
 * written apart from the requirements had no name to point at.
 */
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
