export { RequirementEvaluator } from "./Application/RequirementEvaluator.js";
export { RequiredFacts, type RequiredFactsRequest } from "./Application/RequiredFacts.js";
export {
  mergeRequirementRuns,
  MergedRunWithoutTargetsError,
} from "./Application/MergeRequirementRuns.js";
export type {
  CheckStatus,
  RequirementCheckNode,
  RequirementExpected,
  RequirementLeafCheck,
  RequirementResult,
  RequirementRun,
  RequirementTarget,
  TargetlessRequirement,
} from "./Domain/Requirements.js";
