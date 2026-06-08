import type { ConfigDefinition } from "../Domain/ConfigDefinition.js";
import type { ConfigJsonSchemaBackend, JsonSchema } from "../Ports/ConfigJsonSchemaBackend.js";

export class ConfigJsonSchemaEmitter {
  private readonly backend: ConfigJsonSchemaBackend;

  constructor(backend: ConfigJsonSchemaBackend) {
    this.backend = backend;
  }

  emit<TConfig>(definition: ConfigDefinition<TConfig>): JsonSchema {
    return this.backend.emit(definition);
  }
}
