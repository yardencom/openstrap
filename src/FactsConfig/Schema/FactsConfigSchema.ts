import { ConfigSchemaDefinitionDto } from "../../ConfigCore/index.js";
import type { FactsDefinition } from "../Domain/Entities/FactsDefinition.js";
import { FactsConfigMetadata } from "./FactsConfigMetadata.js";
import { FactsDefinitionSchema } from "./FactsDefinitionSchema.js";

export class FactsConfigSchema {
  static build(): ConfigSchemaDefinitionDto<FactsDefinition> {
    return new ConfigSchemaDefinitionDto<FactsDefinition>({
      metadata: FactsConfigMetadata.build(),
      rootSchema: FactsDefinitionSchema.build(),
    });
  }
}
