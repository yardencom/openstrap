import type { FactSections } from "./Facts.js";
import type { Immutable } from "./Immutable.js";
import type { Step } from "./Step.js";

/**
 * One thing a machine was required to be and is not.
 *
 * A leaf of a requirement's result, flattened: which requirement asked, where in the facts it asked,
 * what it wanted, what it found. Nothing is added — openstrap already worked all of this out when it
 * compared the reading with the blueprint, and this is that answer with the tree taken off.
 *
 * Only failures become one of these. A check that came back `error` says the machine could not be
 * read at that point, and a machine nobody could read is not a machine anybody should start running
 * commands on: the reading is the thing to fix, not the machine.
 */
export type Unsatisfied = {
  requirementId: string;
  /** Where in the facts: `network.ports.tcp/6443.state`. */
  path: string;
  expected: unknown;
  actual: unknown;
  message?: string;
};

/**
 * Something that knows how to make a fact true.
 *
 * The only extension point of the whole module, and the only place a product's name is allowed to
 * appear. openstrap never works out the "how" from the "what": `tcp/6443 is not listening` does not
 * imply `install k3s` — it implies that somebody who knows this machine has to say so. A guess that
 * runs commands as root is the worst kind of guess, so there is none.
 *
 * A resolver that does not recognise a path returns nothing, and the failure is reported as
 * unresolved rather than quietly dropped.
 */
export interface Resolver {
  readonly id: string;
  resolve(unsatisfied: Unsatisfied, facts: Immutable<FactSections>): readonly Step[] | undefined;
}
