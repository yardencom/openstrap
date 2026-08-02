import {
  ConfigCore,
  type ConfigLoadRequest,
} from "../../ConfigCore/index.js";
import type { Blueprint, BlueprintTarget } from "#types/Blueprint.js";
import { BlueprintReadError } from "./errors/BlueprintReadError.js";
import { BlueprintSchema } from "./schema/BlueprintSchema.js";

/**
 * The blueprint a developer wrote, as the targets a run works with.
 *
 * Nothing is derived on the way in. A target is what was written plus the name it was written
 * under — the key of the record becomes a field, because from here on a target travels alone and
 * has to know what it is called. Requirements are already inside the target they are about, so
 * nothing is regrouped and nothing can point at a target that is not there.
 */
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

    const targets: Record<string, BlueprintTarget> = {};

    for (const [name, target] of Object.entries(config.targets)) {
      targets[name] = { name, ...target, requirements: target.requirements ?? [] };
    }

    return { targets };
  }
}
