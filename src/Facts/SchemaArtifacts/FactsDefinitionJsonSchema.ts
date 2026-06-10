import {
  ConfigCore,
  type JsonSchema,
} from "../../ConfigCore/index.js";
import { FactsDefinitionConfigSchema } from "../Definition/Schema/FactsDefinitionConfigSchema.js";

const configCore = new ConfigCore();
const schemaDefinition = FactsDefinitionConfigSchema.build(configCore.schema);

export class FactsDefinitionJsonSchema {
  emit(): Readonly<JsonSchema> {
    return configCore.emitJsonSchema(schemaDefinition);
  }
}
