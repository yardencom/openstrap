import type { ConfigDefinition } from "../Domain/ConfigDefinition.js";
import type { LoadedConfig } from "../Ports/ConfigLoaderBackend.js";
import type { ConfigValidatorBackend, ValidatedConfig } from "../Ports/ConfigValidatorBackend.js";

export class ConfigSchemaValidator {
  private readonly backend: ConfigValidatorBackend;

  constructor(backend: ConfigValidatorBackend) {
    this.backend = backend;
  }

  validate<TConfig>(definition: ConfigDefinition<TConfig>, config: LoadedConfig): ValidatedConfig<TConfig> {
    return this.backend.validate(definition, config);
  }
}
