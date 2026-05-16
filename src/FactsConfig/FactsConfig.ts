import {
  ConfigLoader,
  ConfigParseError,
  ConfigValidationError,
  ConfigSchemaJsonSchemaEmitter,
  ConfigSchemaValidator,
  type JsonSchemaDocumentDto,
} from "../ConfigCore/index.js";
import type { FactsDefinition } from "./Domain/Entities/FactsDefinition.js";
import { FactsDefinitionValidationError } from "./Domain/FactsDefinitionErrors.js";
import { FactsConfigSchema } from "./Schema/FactsConfigSchema.js";

export class FactsConfig {
  private static readonly schemaDefinition = FactsConfigSchema.build();
  private static readonly loader = new ConfigLoader(new ConfigSchemaValidator(FactsConfig.schemaDefinition));
  private static readonly jsonSchemaEmitter = new ConfigSchemaJsonSchemaEmitter<FactsDefinition>();

  parseYaml(yamlText: string): Readonly<FactsDefinition> {
    try {
      return FactsConfig.loader.load({
        format: "yaml",
        content: yamlText,
      }).config;
    } catch (error) {
      if (error instanceof ConfigValidationError || error instanceof ConfigParseError) {
        throw new FactsDefinitionValidationError(error.issues);
      }

      throw error;
    }
  }

  getJsonSchema(): Readonly<JsonSchemaDocumentDto> {
    return FactsConfig.jsonSchemaEmitter.emit(FactsConfig.schemaDefinition);
  }
}
