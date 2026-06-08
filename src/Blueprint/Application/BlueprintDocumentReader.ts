import {
  ConfigCore,
  ConfigParseError,
  ConfigValidationError,
  type ConfigLoadRequest,
  type JsonSchema,
} from "../../ConfigCore/index.js";
import type { BlueprintDocument } from "../Domain/BlueprintDocument.js";
import { BlueprintDocumentReadError } from "../Domain/BlueprintIssues.js";
import { BlueprintDocumentSchema } from "../Schema/BlueprintDocumentSchema.js";

export class BlueprintDocumentReader {
  private readonly configCore: ConfigCore;
  private readonly schemaDefinition;

  constructor(configCore = new ConfigCore()) {
    this.configCore = configCore;
    this.schemaDefinition = BlueprintDocumentSchema.build(configCore.schema);
  }

  read(request: ConfigLoadRequest): BlueprintDocument {
    try {
      return this.configCore.load(this.schemaDefinition, request);
    } catch (error) {
      if (error instanceof ConfigValidationError || error instanceof ConfigParseError) {
        throw new BlueprintDocumentReadError(error.issues);
      }

      throw error;
    }
  }

  readInline(yamlText: string): BlueprintDocument {
    return this.read({
      mode: "inline",
      content: yamlText,
    });
  }

  getJsonSchema(): Readonly<JsonSchema> {
    return this.configCore.emitJsonSchema(this.schemaDefinition);
  }
}
