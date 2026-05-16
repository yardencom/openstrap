import type { JsonSchemaDocumentDto } from "../Domain/ConfigDtos.js";

export interface JsonSchemaEmitter<TDefinition> {
  emit(definition: TDefinition): JsonSchemaDocumentDto;
}
