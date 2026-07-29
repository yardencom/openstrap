import type { ConfigDefinition } from "../domain/ConfigDefinition.js";
import type { LoadedConfig } from "../ports/ConfigLoaderBackend.js";
import type { ConfigValidatorBackend, ValidatedConfig } from "../ports/ConfigValidatorBackend.js";

export class ConfigSchemaValidator {
  private readonly backend: ConfigValidatorBackend;

  constructor(backend: ConfigValidatorBackend) {
    this.backend = backend;
  }

  validate<TConfig>(definition: ConfigDefinition<TConfig>, config: LoadedConfig): ValidatedConfig<TConfig> {
    return this.backend.validate(definition, config);
  }
}
