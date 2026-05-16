import type { ConfigFilePatternDto } from "./ConfigFilePatternDto.js";

export class ConfigSchemaMetadataDto {
  readonly kind: string;
  readonly schemaId: string;
  readonly title: string;
  readonly description: string;
  readonly filePatterns: readonly ConfigFilePatternDto[];

  constructor(params: {
    kind: string;
    schemaId: string;
    title: string;
    description: string;
    filePatterns: readonly ConfigFilePatternDto[];
  }) {
    this.kind = params.kind;
    this.schemaId = params.schemaId;
    this.title = params.title;
    this.description = params.description;
    this.filePatterns = params.filePatterns;
  }
}
