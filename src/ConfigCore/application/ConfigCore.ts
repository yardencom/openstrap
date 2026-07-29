import { ConfigNotFoundError } from "../errors/ConfigNotFoundError.js";
import type { ConfigDefinition } from "../ConfigDefinition.js";
import type { ConfigLoadRequest } from "../ports/ConfigLoaderBackend.js";
import type { ConfigSchemaBackend } from "../ports/ConfigSchemaBackend.js";
import type { JsonSchema } from "../ports/ConfigJsonSchemaBackend.js";
import { ConfigSchemaBackendProvider } from "./ConfigSchemaBackendProvider.js";
import { ConfigJsonSchemaEmitter } from "./ConfigJsonSchemaEmitter.js";
import { ConfigLoader } from "./ConfigLoader.js";
import { ConfigSchema } from "./ConfigSchema.js";
import { ConfigSchemaValidator } from "./ConfigSchemaValidator.js";

export class ConfigCore {
  private readonly configBackend: ConfigSchemaBackend;
  private readonly configLoader = new ConfigLoader();
  private readonly schemaValidator: ConfigSchemaValidator;
  private readonly jsonSchemaEmitter: ConfigJsonSchemaEmitter;
  readonly schema: ConfigSchema;

  constructor(params: { configBackend?: ConfigSchemaBackend; schemaBackend?: ConfigSchemaBackend } = {}) {
    this.configBackend = params.configBackend ?? params.schemaBackend ?? new ConfigSchemaBackendProvider().create();
    this.schema = new ConfigSchema(this.configBackend.schemaBuilder);
    this.schemaValidator = new ConfigSchemaValidator(this.configBackend.validator);
    this.jsonSchemaEmitter = new ConfigJsonSchemaEmitter(this.configBackend.jsonSchemaEmitter);
  }

  load<TConfig>(definition: ConfigDefinition<TConfig>, request: ConfigLoadRequest): TConfig {
    const loadedConfig = this.configLoader.load({
      ...request,
      filePatterns: definition.filePatterns,
    });

    if (!loadedConfig) {
      throw new ConfigNotFoundError();
    }

    return this.schemaValidator.validate(definition, loadedConfig).config;
  }

  emitJsonSchema<TConfig>(definition: ConfigDefinition<TConfig>): JsonSchema {
    return this.jsonSchemaEmitter.emit(definition);
  }
}
