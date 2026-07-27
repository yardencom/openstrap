import type { Blueprint } from "../../Blueprint/index.js";
import { Facts } from "../../Facts/Facts.js";
import {
  RequirementEvaluator,
  type RequirementRun,
} from "../../Requirements/index.js";
import { mergeRequirementRuns } from "./MergeRequirementRuns.js";

export type OpenStrapRunRequest = {
  blueprint: Blueprint;
  facts: Facts;
  workspaceRoot: string;
  now?: Date;
};

export type OpenStrapRunResult = {
  blueprint: Blueprint;
  facts: Facts;
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
    facts: Facts,
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
