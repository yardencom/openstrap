import type { ConfigSchemaMetadataDto } from "./ConfigSchemaMetadataDto.js";
import type { ConfigSchemaNodeDto } from "./ConfigSchemaNodes.js";

export class ConfigSchemaDefinitionDto<TConfig> {
  readonly metadata: ConfigSchemaMetadataDto;
  readonly rootSchema: ConfigSchemaNodeDto;

  constructor(params: { metadata: ConfigSchemaMetadataDto; rootSchema: ConfigSchemaNodeDto }) {
    this.metadata = params.metadata;
    this.rootSchema = params.rootSchema;
  }
}
