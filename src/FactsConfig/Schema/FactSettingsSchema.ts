import { configSchema } from "../../ConfigCore/index.js";
import { FactImportance } from "../Domain/ValueObjects/FactImportance.js";
import { FactPlatform } from "../Domain/ValueObjects/FactPlatform.js";
import { RedactionStrategy } from "../Domain/ValueObjects/RedactionStrategy.js";
import { FactsConfigPrimitives } from "./FactsConfigPrimitives.js";

export class FactSettingsSchema {
  static properties() {
    return {
      id: FactsConfigPrimitives.factId(),
      importance: configSchema.defaulted(configSchema.enum(FactImportance), FactImportance.Required),
      platforms: configSchema.optional(configSchema.array(configSchema.enum(FactPlatform), { nonempty: true })),
      timeoutMs: configSchema.optional(FactsConfigPrimitives.positiveInteger()),
      maxOutputBytes: configSchema.optional(FactsConfigPrimitives.positiveInteger()),
      redaction: configSchema.optional(this.redaction()),
    };
  }

  private static redaction() {
    const strategy = configSchema.enum(RedactionStrategy);

    return configSchema.union([
      strategy,
      configSchema.strictObject({
        strategy,
        fields: configSchema.optional(configSchema.array(FactsConfigPrimitives.nonEmptyString())),
        patterns: configSchema.optional(configSchema.array(FactsConfigPrimitives.nonEmptyString())),
      }),
    ]);
  }
}
