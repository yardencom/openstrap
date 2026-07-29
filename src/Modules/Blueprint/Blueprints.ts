import {
  ConfigCore,
  type ConfigLoadRequest,
} from "../../ConfigCore/index.js";
import type { Blueprint } from "./domain/Blueprint.js";
import { BlueprintReadError } from "./application/BlueprintReadError.js";
import { declaredTargets } from "./application/DeclaredTargets.js";
import { BlueprintSchema } from "./schema/BlueprintSchema.js";

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

    return declaredTargets(config);
  }
}
