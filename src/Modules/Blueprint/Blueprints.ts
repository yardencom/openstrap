import {
  ConfigCore,
  type ConfigLoadRequest,
} from "../../ConfigCore/index.js";
import type { Blueprint, BlueprintTarget } from "#types/Blueprint.js";
import { BlueprintReadError } from "./errors/BlueprintReadError.js";
import { BlueprintSchema } from "./schema/BlueprintSchema.js";
import { WrittenSteps } from "./WrittenSteps.js";

/** The blueprint a developer wrote, as the targets a run works with. */
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
      // The one thing derived on the way in, and only because two shapes are involved: a step is
      // written with its action as a key and no name, and carried as a named, tagged record that can
      // be printed, stored and sent to another machine. Taking the steps out of the requirements is
      // part of the same move — what reaches the checker has to be a statement about a machine.
      const written = new WrittenSteps(target);
      const steps = written.steps();

      targets[name] = {
        name,
        ...target,
        requirements: written.requirements(),
        ...(steps.length === 0 ? { steps: undefined } : { steps }),
      };
    }

    return { targets };
  }
}
