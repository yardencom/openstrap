import type { CheckStatus, RequirementRun } from "#types/Requirements.js";

/**
 * Folds one evaluation per target into a single run.
 *
 * A run already describes several targets — it carries a target map and every
 * result names its own target — so nothing new is modelled here. Only the outcome
 * is decided: each target is judged on its own, and the whole is as bad as its
 * worst target.
 *
 * Merging zero runs is refused rather than answered with an empty one: a run has an
 * identity and a start, and neither can be made out of nothing.
 */
export class MergedRunWithoutTargetsError extends Error {
  constructor() {
    super("A requirement run needs at least one target to merge");
    this.name = "MergedRunWithoutTargetsError";
  }
}

export function mergeRequirementRuns(runs: readonly RequirementRun[]): RequirementRun {
  const [first] = runs;

  if (!first) {
    throw new MergedRunWithoutTargetsError();
  }

  if (runs.length === 1) {
    return first;
  }

  const results = runs.flatMap((run) => run.results);
  const status = aggregateStatuses(runs.map((run) => run.status));

  return {
    ...first,
    status,
    targets: Object.assign({}, ...runs.map((run) => run.targets)) as Record<string, string>,
    results,
    details: status === "passed" ? undefined : {
      message: runs
        .filter((run) => run.status !== "passed")
        .map((run) => run.details?.message)
        .filter(Boolean)
        .join("; "),
    },
  };
}

function aggregateStatuses(statuses: readonly CheckStatus[]): CheckStatus {
  if (statuses.length === 0 || statuses.every((status) => status === "skipped")) {
    return "skipped";
  }

  if (statuses.includes("error")) {
    return "error";
  }

  if (statuses.includes("failed")) {
    return "failed";
  }

  return "passed";
}
