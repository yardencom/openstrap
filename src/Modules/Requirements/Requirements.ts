import { RequiredFacts } from "./RequiredFacts.js";
import { RequirementEvaluator, type EvaluationRequest } from "./check/RequirementEvaluator.js";
import type { FactDeclaration } from "#types/FactDeclaration.js";
import type { RequirementRun, TargetlessRequirement } from "#types/Requirements.js";

export type { EvaluationRequest } from "./check/RequirementEvaluator.js";

/** What is required of a machine, and the two things anyone ever asks of it. */
export class Requirements {
  constructor(private readonly requirements: readonly TargetlessRequirement[]) {}

  /** What has to be read from the machine before any of this can be checked. */
  order(): FactDeclaration {
    return new RequiredFacts({ requirements: this.requirements }).declaration as FactDeclaration;
  }

  /** How the machine measured up, once it has been read. */
  checkedAgainst(request: Omit<EvaluationRequest, "requirements">): RequirementRun {
    return new RequirementEvaluator().evaluate({ ...request, requirements: this.requirements });
  }
}
