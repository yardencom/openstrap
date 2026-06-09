import {
  ConfigCore,
  ConfigParseError,
  ConfigValidationError,
} from "../ConfigCore/index.js";
import type { FactsDefinition } from "./Domain/Entities/FactsDefinition.js";
import { FactsDefinitionValidationError } from "./Domain/FactsDefinitionErrors.js";
import { FactsDefinitionConfigSchema } from "./Schema/FactsDefinitionConfigSchema.js";

const configCore = new ConfigCore();
const schemaDefinition = FactsDefinitionConfigSchema.build(configCore.schema);

export class FactsDefinitionReader {
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
}
