import { RequiredFacts } from "./RequiredFacts.js";
import { RequirementEvaluator, type EvaluationRequest } from "./RequirementEvaluator.js";
import type { FactDeclaration } from "#types/FactDeclaration.js";
import type { RequirementRun, TargetlessRequirement } from "#types/Requirements.js";

export type { EvaluationRequest } from "./RequirementEvaluator.js";

/**
 * What is required of a machine, and the two things anyone ever asks of it.
 *
 * The way into this module. Requirements are written in a blueprint and used twice, once before the
 * machine is read and once after: they say what has to be collected, and then they judge what came
 * back. Both answers come from the same list, and a caller holding the list is a caller that cannot
 * accidentally judge against a reading it did not ask for.
 *
 * Neither of the two knows about the other, which is why they are separate classes behind this one:
 * ordering is about what a machine can be asked, judging is about comparing two documents.
 */
export class Requirements {
  constructor(private readonly requirements: readonly TargetlessRequirement[]) {}

  /**
   * What has to be read from the machine before any of this can be checked.
   *
   * @param workspaceRoot Where the run is happening, for a requirement written about `workspace`.
   */
  order(workspaceRoot?: string): FactDeclaration {
    return new RequiredFacts({ requirements: this.requirements, workspaceRoot }).declaration as FactDeclaration;
  }

  /** How the machine measured up, once it has been read. */
  checkedAgainst(request: Omit<EvaluationRequest, "requirements">): RequirementRun {
    return new RequirementEvaluator().evaluate({ ...request, requirements: this.requirements });
  }
}
