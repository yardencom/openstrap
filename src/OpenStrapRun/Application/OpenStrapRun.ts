import type { Blueprint } from "../../Blueprint/index.js";
import type { Facts } from "../../Facts/Facts.js";
import {
  RequirementEvaluator,
  type RequirementRun,
} from "../../Requirements/index.js";
import { mergeRequirementRuns } from "./MergeRequirementRuns.js";

/**
 * What the facts module hands back.
 *
 * Spelled through the one entry point rather than imported as a type of its own:
 * a fact collection only exists as the result of a reading, and nothing outside
 * that module is allowed to name its parts.
 */
type CollectedFacts = Awaited<ReturnType<Facts["collect"]>>;

export type OpenStrapRunRequest = {
  blueprint: Blueprint;
  facts: CollectedFacts;
  workspaceRoot: string;
  now?: Date;
};

export type OpenStrapRunResult = {
  blueprint: Blueprint;
  facts: CollectedFacts;
  requirementRun: RequirementRun;
};

export class OpenStrapRun {
  constructor(private readonly requirementEvaluator = new RequirementEvaluator()) {}

  async execute(request: OpenStrapRunRequest): Promise<OpenStrapRunResult> {
    const blueprint = request.blueprint;
    const facts = request.facts;
    const requirementRun = this.evaluateBlueprintRequirements(blueprint, facts, request);

    return {
      blueprint,
      facts,
      requirementRun,
    };
  }

  private evaluateBlueprintRequirements(
    blueprint: Blueprint,
    facts: CollectedFacts,
    request: OpenStrapRunRequest,
  ): RequirementRun {
    return mergeRequirementRuns(
      Object.values(blueprint.targets).map((target) => this.requirementEvaluator.evaluate({
        target,
        requirements: target.requirements,
        factCollection: facts,
        now: request.now,
        trigger: "manual",
        profile: "local-run",
        purpose: "preflight",
      })),
    );
  }
}
