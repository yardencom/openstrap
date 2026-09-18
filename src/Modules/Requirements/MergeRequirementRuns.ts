import { MergedRunWithoutTargetsError } from "./errors/MergedRunWithoutTargetsError.js";
import type { CheckStatus, RequirementRun } from "#types/Requirements.js";

/** Folds one evaluation per target into a single run. */
export class MergeRequirementRuns {
  static of(runs: readonly RequirementRun[]): RequirementRun {
    const [first] = runs;

    if (!first) {
      throw new MergedRunWithoutTargetsError();
    }

    if (runs.length === 1) {
      return first;
    }

    const status = MergeRequirementRuns.worstOf(runs.map((run) => run.status));

    return {
      ...first,
      status,
      targets: Object.assign({}, ...runs.map((run) => run.targets)) as Record<string, string>,
      results: runs.flatMap((run) => run.results),
      details: status === "passed" ? undefined : {
        message: runs
          .filter((run) => run.status !== "passed")
          .map((run) => run.details?.message)
          .filter(Boolean)
          .join("; "),
      },
    };
  }

  private static worstOf(statuses: readonly CheckStatus[]): CheckStatus {
    if (statuses.length === 0 || statuses.every((status) => status === "skipped")) {
      return "skipped";
    }

    if (statuses.includes("error")) {
      return "error";
    }

    return statuses.includes("failed") ? "failed" : "passed";
  }
}
