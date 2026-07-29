import type { ConfigDefinition } from "../domain/ConfigDefinition.js";
import type { LoadedConfig, LoadedConfigSource } from "./ConfigLoaderBackend.js";

export type ValidatedConfig<TConfig> = {
  kind: string;
  schemaId: string;
  config: TConfig;
  source?: LoadedConfigSource;
};

export interface ConfigValidatorBackend {
  validate<TConfig>(
    definition: ConfigDefinition<TConfig>,
    config: LoadedConfig,
  ): ValidatedConfig<TConfig>;
}
