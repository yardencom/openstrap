import type { Action } from "./Action.js";

/**
 * A condition on the facts, written the way a requirement is written.
 *
 * `{ services: { postgres: { status: "present" } } }` — the same words, checked by the same code.
 * There is no second language for "when is this already true", because two languages for one
 * question is two spellings of `network.ports.tcp/5432`, and one of them would be the one nobody
 * updated.
 *
 * A requirement's own `id` is not here: a guard is not a requirement anybody declared, it is a
 * condition attached to a step, and it is named after the step.
 */
export type Guard = Readonly<Record<string, unknown>>;

/**
 * One thing to do, and what it is for.
 *
 * A step is planned when something it is for is not true, and disappears from the plan the moment
 * that becomes true — which is why most steps need no guard. The facts decide, not a flag somebody
 * set, and nothing has to remember that a step ran.
 *
 * What a step is for is always the same thing — requirements — and it is said one of two ways. A
 * step written inside a requirement is for that one, and nobody writes anything: the connection is
 * where the step sits. A step written beside them names the ones it is for, because it is for more
 * than one and cannot sit in both.
 *
 * It used to be fact paths, and that was wrong twice over. It made a step carry a copy of
 * `network.ports.tcp/5432` that was already written ten lines above it, and a typo in that copy
 * validated fine and then quietly never matched anything. A requirement has a name, the name is in
 * the same file, and a name that is not there can be refused when the blueprint is read.
 *
 * A step produced by a resolver names nothing: it was handed one failure and answered it, so what
 * it is for is the question it was asked.
 *
 * `guard` is for what none of this covers: a step whose effect the requirements do not describe, or
 * one that must not be repeated. It is an optimisation and not a safety device — a step is expected
 * to be safe to run twice, because a machine read between two passes can change under openstrap's
 * feet.
 */
export type Step = {
  id: string;
  /** The requirements this step makes true. */
  requirements?: readonly string[];
  guard?: Guard;
  action: Action;
};

export type StepStatus = "done" | "skipped" | "failed";

/**
 * What one step came to.
 *
 * A step that failed is a result and not an exception: the pass carries on, because a step failing
 * because its turn has not come yet is the ordinary case in a loop that has no dependency graph, and
 * the next pass reads the machine again and finds out.
 */
export type StepOutcome = {
  stepId: string;
  status: StepStatus;
  /** Why it was skipped, or how it failed. Nothing to say when it simply worked. */
  message?: string;
};

/** One action, in one line, close enough to what it does that a reader can object to it. */
export function actionSaid(action: Action): string {
  switch (action.kind) {
    case "run":
      return action.shell
        ? `run ${action.args[1] ?? ""}`
        : `run ${action.command} ${action.args.join(" ")}`.trimEnd();
    case "write":
      return `write ${action.path}`;
    case "remove":
      return `remove ${action.path}`;
    case "download":
      return `download ${action.url} to ${action.path}`;
  }
}
