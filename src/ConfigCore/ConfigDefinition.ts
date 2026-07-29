import type { ConfigSchemaNode } from "./ConfigSchemaNode.js";

export class ConfigDefinition<TConfig> {
  readonly kind: string;
  readonly schemaId: string;
  readonly title: string;
  readonly description: string;
  readonly filePatterns: readonly string[];
  readonly rootSchema: ConfigSchemaNode<TConfig>;

  constructor(params: {
    kind: string;
    schemaId: string;
    title: string;
    description: string;
    filePatterns?: readonly string[];
    rootSchema: ConfigSchemaNode<TConfig>;
  }) {
    this.kind = params.kind;
    this.schemaId = params.schemaId;
    this.title = params.title;
    this.description = params.description;
    this.filePatterns = params.filePatterns ?? [];
    this.rootSchema = params.rootSchema;
  }
}
