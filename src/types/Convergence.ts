import type { Plan } from "./Plan.js";
import type { RequirementRun } from "./Requirements.js";
import type { StepOutcome } from "./Step.js";
import type { Unsatisfied } from "./Unsatisfied.js";

/** One turn of the loop: what was wrong when it started, and what was done about it. */
export type ConvergencePass = {
  /** Counting from one, the way a person counts attempts. */
  number: number;
  unsatisfied: number;
  applied: readonly StepOutcome[];
};

/** Why the loop stopped, which is not the same question as whether the machine is now right. */
export type ConvergenceEnd =
  /** Every requirement passes. */
  | "satisfied"
  /** Only a plan was asked for. */
  | "checked"
  /** A pass ran and moved nothing, so another would run the same steps again. */
  | "stalled"
  /** Something is still not true and nothing left knows how to make it true. */
  | "unresolved"
  /** The bound was reached with work still to do. */
  | "exhausted";

/** What came of bringing a machine to what its blueprint declares. */
export type Convergence = {
  passes: readonly ConvergencePass[];
  /** The plan as it stood at the last reading: what is still not true, and what nobody can answer. */
  plan: Plan;
  unresolved: readonly Unsatisfied[];
  end: ConvergenceEnd;
  /** The proof: the machine read afresh and judged against the same requirements. */
  requirementRun: RequirementRun;
};
