import type { Step } from "./Step.js";
import type { Unsatisfied } from "./Unsatisfied.js";

/**
 * What is not true, what is going to be done about it, and what nobody could answer.
 *
 * Three lists rather than one, because all three are things a person asks before letting anything
 * run. `unsatisfied` is the machine as it stands against the blueprint; `steps` is the answer;
 * `unresolved` is the part of the question openstrap cannot answer at all, said out loud instead of
 * being left as an empty plan that looks like nothing to do.
 *
 * A plan is data all the way down, so `--check` is this printed and nothing else happening.
 */
export type Plan = {
  unsatisfied: readonly Unsatisfied[];
  steps: readonly Step[];
  unresolved: readonly Unsatisfied[];
};
