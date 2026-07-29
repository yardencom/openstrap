import type { ConfigDefinition } from "../domain/ConfigDefinition.js";

export type JsonSchema = Record<string, unknown> & {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
};

export interface ConfigJsonSchemaBackend {
  emit<TConfig>(definition: ConfigDefinition<TConfig>): JsonSchema;
}
