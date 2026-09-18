import type { FactSections } from "./Facts.js";
import type { Immutable } from "./Immutable.js";
import type { Step } from "./Step.js";

/** One thing a machine was required to be and is not: a failed leaf of a requirement result, flattened. */
export type Unsatisfied = {
  requirementId: string;
  /** Where in the facts: `network.ports.tcp/6443.state`. */
  path: string;
  expected: unknown;
  actual: unknown;
  message?: string;
};

/**
 * Something that knows how to make a fact true: the module's only extension point, and the only place a
 * product's name may appear.
 */
export interface Resolver {
  readonly id: string;
  resolve(unsatisfied: Unsatisfied, facts: Immutable<FactSections>): readonly Step[] | undefined;
}
