import {
  ConfigCore,
  type JsonSchema,
} from "../../ConfigCore/index.js";
import { BlueprintDocumentSchema } from "./BlueprintDocumentSchema.js";

const configCore = new ConfigCore();
const schemaDefinition = BlueprintDocumentSchema.build(configCore.schema);

export class BlueprintJsonSchema {
  emit(): Readonly<JsonSchema> {
    return configCore.emitJsonSchema(schemaDefinition);
  }
}
