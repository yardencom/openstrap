import { CheckOutcome } from "./CheckOutcome.js";
import { RequirementCheck } from "./RequirementCheck.js";
import type { RequirementResult, RequirementRun, TargetlessRequirement } from "#types/Requirements.js";
import type { FactSnapshot } from "#types/FactSnapshot.js";
import type { Target } from "#types/Target.js";

export type EvaluationRequest = {
  target: Target;
  requirements: readonly TargetlessRequirement[];
  snapshots: readonly FactSnapshot[];
  now?: Date;
  attempt?: number;
  trigger?: string;
  profile?: string;
  purpose?: string;
};

/** Every requirement of one machine, checked, and written down as one run. */
export class RequirementEvaluator {
  evaluate(request: EvaluationRequest): RequirementRun {
    const evaluatedAt = request.now ?? new Date();
    const snapshot = request.snapshots.find((taken) => taken.target.id === request.target.name);
    const results = request.requirements.map((requirement) =>
      new RequirementCheck(requirement).against(snapshot, request.target.name),
    );
    const status = CheckOutcome.ofAll(results.map((result) => result.status));

    return {
      id: `req_run_${evaluatedAt.toISOString().replace(/[^0-9A-Za-z]/g, "")}`,
      status,
      evaluatedAt: evaluatedAt.toISOString(),
      attempt: request.attempt ?? 1,
      trigger: request.trigger ?? "manual",
      profile: request.profile ?? "local-vm-preflight",
      purpose: request.purpose ?? "preflight",
      targets: {
        [request.target.name]: request.target.name,
      },
      results,
      details: status === "passed" ? undefined : { message: RequirementEvaluator.whatWentWrong(results) },
    };
  }

  private static whatWentWrong(results: readonly RequirementResult[]): string {
    return results
      .filter((result) => result.status !== "passed")
      .map((result) => `${result.requirementId}: ${result.status}`)
      .join("; ");
  }
}

/** The short of it: which requirements are not passing, and how each is not passing. */
