import type { CheckStatus, RequirementRun } from "../../Requirements/index.js";

/**
 * Folds one evaluation per target into the single run a blueprint produces.
 *
 * A run already describes several targets — it carries a target map and every
 * result names its own target — so nothing new is modelled here. Only the
 * order of evaluation is decided: each target is judged on its own, and the
 * run as a whole is as bad as its worst target.
 */
export function mergeRequirementRuns(runs: readonly RequirementRun[]): RequirementRun {
  const [first] = runs;

  if (!first) {
    throw new Error("A blueprint run needs at least one target");
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
