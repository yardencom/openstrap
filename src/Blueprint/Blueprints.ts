import {
  ConfigCore,
  type ConfigLoadRequest,
} from "../ConfigCore/index.js";
import type { Blueprint } from "./Domain/Blueprint.js";
import { BlueprintReadError, BlueprintTargetError } from "./Application/BlueprintErrors.js";
import { declaredTargets, unknownRequirementTargets } from "./Application/DeclaredTargets.js";
import { BlueprintSchema } from "./Schema/BlueprintSchema.js";

export class Blueprints {
  private readonly schemaDefinition;

  constructor(private readonly configCore = new ConfigCore()) {
    this.schemaDefinition = new BlueprintSchema(configCore.schema);
  }

  load(request: ConfigLoadRequest): Readonly<Blueprint> {
    let config;

    try {
      config = this.configCore.load(this.schemaDefinition, request);
    } catch (error) {
      throw new BlueprintReadError(error);
    }

    const unknown = unknownRequirementTargets(config);

    if (unknown.length > 0) {
      throw new BlueprintTargetError(unknown, Object.keys(config.targets));
    }

    return declaredTargets(config);
  }
}
