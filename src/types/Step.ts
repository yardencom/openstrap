import type { Action } from "./Action.js";

/** A condition on the facts, written the way a requirement is written. */
export type Guard = Readonly<Record<string, unknown>>;

/** One thing to do, and what it is for. */
export type Step = {
  id: string;
  requirements?: readonly string[];
  guard?: Guard;
  action: Action;
};

export type StepStatus = "done" | "skipped" | "failed";

/** What one step came to. */
export type StepOutcome = {
  stepId: string;
  status: StepStatus;
  /** Why it was skipped, or how it failed. Nothing to say when it simply worked. */
  message?: string;
};
