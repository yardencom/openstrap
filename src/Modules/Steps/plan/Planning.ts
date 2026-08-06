import type { FactSections } from "#types/Facts.js";
import type { Immutable } from "#types/Immutable.js";
import type { Plan } from "#types/Plan.js";
import type { Resolver, Unsatisfied } from "#types/Unsatisfied.js";
import type { Step } from "#types/Step.js";

/**
 * What to do about a machine that is not what it was declared to be.
 *
 * Every failure is put to the resolvers in turn, and the first that recognises it answers. In turn
 * and not all at once: two resolvers that both know how to install a thing would otherwise both
 * install it, and which of them is right is a question about this machine that openstrap has no way
 * to settle. Order is the caller's to decide, and the caller is whoever assembled the list.
 *
 * One step often answers many failures — a thing being there, being started, being on at boot, and
 * a port being open can all be one installation — so steps are gathered by id rather than per
 * failure. A resolver returning the same step for six failures produces one step, and nothing has
 * to know it was asked six times.
 *
 * What nobody claims is `unresolved`. Not dropped: a plan that quietly omitted half the blueprint
 * would run, report every step done, and leave the machine wrong — and the run would look like a
 * success, which is the one outcome worse than a failure.
 */
export class Planning {
  constructor(private readonly resolvers: readonly Resolver[]) {}

  of(unsatisfied: readonly Unsatisfied[], facts: Immutable<FactSections>): Plan {
    const steps = new Map<string, Step>();
    const unresolved: Unsatisfied[] = [];

    for (const failure of unsatisfied) {
      const answering = this.answer(failure, facts);

      if (answering === undefined) {
        unresolved.push(failure);
        continue;
      }

      for (const step of answering) {
        steps.set(step.id, step);
      }
    }

    return { unsatisfied, steps: [...steps.values()], unresolved };
  }

  private answer(failure: Unsatisfied, facts: Immutable<FactSections>): readonly Step[] | undefined {
    for (const resolver of this.resolvers) {
      const steps = resolver.resolve(failure, facts);

      // An empty list is an answer: this resolver knows the path and has nothing to do about it in
      // the state the machine is in. Only `undefined` means it did not recognise the question.
      if (steps !== undefined) {
        return steps;
      }
    }

    return undefined;
  }
}
