import {
  ConfigCore,
  ConfigParseError,
  ConfigValidationError,
  type JsonSchema,
} from "../ConfigCore/index.js";
import type { FactsDefinition } from "./Domain/Entities/FactsDefinition.js";
import { FactsDefinitionValidationError } from "./Domain/FactsDefinitionErrors.js";
import { FactsConfigSchema } from "./Schema/FactsConfigSchema.js";

const configCore = new ConfigCore();
const schemaDefinition = FactsConfigSchema.build(configCore.schema);

export class FactsConfig {
  parseYaml(yamlText: string): Readonly<FactsDefinition> {
    try {
      return configCore.load(schemaDefinition, {
        mode: "inline",
        content: yamlText,
      });
    } catch (error) {
      if (error instanceof ConfigValidationError || error instanceof ConfigParseError) {
        throw new FactsDefinitionValidationError(error.issues);
      }

      throw error;
    }
  }

  getJsonSchema(): Readonly<JsonSchema> {
    return configCore.emitJsonSchema(schemaDefinition);
  }
}
