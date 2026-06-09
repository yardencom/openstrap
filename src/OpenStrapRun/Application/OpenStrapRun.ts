import { Blueprints, type OpenStrapBlueprint } from "../../Blueprint/index.js";
import {
  createFactCollection,
  type FactCollection,
} from "../../Facts/index.js";
import { SystemInformationFactCollector } from "../../Facts/Adapters/SystemInformationFactCollector.js";
import {
  RequirementEvaluator,
  type RequirementRun,
} from "../../Requirements/index.js";
import type { FactsBackend } from "../../Plugin/index.js";
import { RequirementFactCollectionRequestBuilder } from "./RequirementFactCollectionRequestBuilder.js";

export type OpenStrapRunRequest = {
  configPath?: string;
  workspaceRoot: string;
  now?: Date;
};

export type OpenStrapRunResult = {
  blueprint: OpenStrapBlueprint;
  facts: FactCollection;
  requirementRun: RequirementRun;
};

export class OpenStrapRun {
  constructor(
    private readonly blueprints = new Blueprints(),
    private readonly factRequestBuilder = new RequirementFactCollectionRequestBuilder(),
    private readonly factsBackend: FactsBackend = {
      id: "openstrap:systeminformation",
      capabilities: {
        scopes: ["host", "guest", "network"],
        sections: [
          "os",
          "arch",
          "cpu",
          "memory",
          "storage",
          "network",
          "users",
          "packages",
          "processes",
          "services",
          "transports",
          "privileges",
          "runtimes",
          "paths",
          "tools",
        ],
      },
      collect: (request) => new SystemInformationFactCollector().collect(request),
    },
    private readonly requirementEvaluator = new RequirementEvaluator(),
  ) {}

  async execute(request: OpenStrapRunRequest): Promise<OpenStrapRunResult> {
    const blueprint = this.readBlueprint(request);
    const facts = await this.collectFactsForBlueprint(blueprint, request);
    const requirementRun = this.evaluateBlueprintRequirements(blueprint, facts, request);

    return {
      blueprint,
      facts,
      requirementRun,
    };
  }

  private readBlueprint(request: OpenStrapRunRequest): OpenStrapBlueprint {
    if (request.configPath) {
      return this.blueprints.load({
        mode: "explicit",
        path: request.configPath,
      });
    }

    return this.blueprints.load({
      mode: "default",
      workspaceRoot: request.workspaceRoot,
    });
  }

  private collectFactsForBlueprint(
    blueprint: OpenStrapBlueprint,
    request: OpenStrapRunRequest,
  ): Promise<FactCollection> {
    const factRequest = this.factRequestBuilder.build({
      targets: blueprint.targets,
      requirements: blueprint.requirements,
      workspaceRoot: request.workspaceRoot,
      now: request.now,
    });

    return Promise.resolve(this.factsBackend.collect(factRequest)).then(createFactCollection);
  }

  private evaluateBlueprintRequirements(
    blueprint: OpenStrapBlueprint,
    facts: FactCollection,
    request: OpenStrapRunRequest,
  ): RequirementRun {
    return this.requirementEvaluator.evaluate({
      requirements: blueprint.requirements,
      targets: blueprint.targets,
      factCollection: facts,
      now: request.now,
      trigger: "manual",
      profile: "local-run",
      purpose: "preflight",
    });
  }
}
