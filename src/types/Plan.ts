import type { Step } from "./Step.js";
import type { Unsatisfied } from "./Unsatisfied.js";

/** What is not true, what is going to be done about it, and what nobody could answer. */
export type Plan = {
  unsatisfied: readonly Unsatisfied[];
  steps: readonly Step[];
  unresolved: readonly Unsatisfied[];
};
