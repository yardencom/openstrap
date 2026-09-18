import type { FactSections } from "#types/Facts.js";
import type { Immutable } from "#types/Immutable.js";
import type { Plan } from "#types/Plan.js";
import type { Resolver, Unsatisfied } from "#types/Unsatisfied.js";
import type { Step } from "#types/Step.js";

/** What to do about a machine that is not what it was declared to be. */
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
