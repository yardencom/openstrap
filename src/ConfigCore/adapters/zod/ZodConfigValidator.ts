import { ConfigValidationError } from "../../domain/ConfigValidationError.js";
import type { ConfigDefinition } from "../../domain/ConfigDefinition.js";
import type { LoadedConfig } from "../../ports/ConfigLoaderBackend.js";
import type { ValidatedConfig } from "../../ports/ConfigValidatorBackend.js";
import type { ZodSchemaRegistry } from "./ZodSchemaRegistry.js";

export class ZodConfigValidator {
  constructor(private readonly schemas: ZodSchemaRegistry) {}

  validate<TConfig>(definition: ConfigDefinition<TConfig>, config: LoadedConfig): ValidatedConfig<TConfig> {
    const result = this.schemas.get(definition.rootSchema).safeParse(config.value);

    if (!result.success) {
      throw new ConfigValidationError({
        kind: definition.kind,
        schemaId: definition.schemaId,
        issues: result.error.issues.map((issue) => ({
          path: issue.path.map(String),
          message: issue.message,
          code: issue.code,
        })),
      });
    }

    return {
      kind: definition.kind,
      schemaId: definition.schemaId,
      source: config.source,
      config: result.data,
    };
  }
}
