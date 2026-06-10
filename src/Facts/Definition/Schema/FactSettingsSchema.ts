import type { ConfigSchema, ConfigSchemaNode } from "../../../ConfigCore/index.js";
import type { FactId } from "../Domain/ValueObjects/FactId.js";
import type { FactSettings } from "../Domain/ValueObjects/FactSettings.js";
import { FactImportance } from "../Domain/ValueObjects/FactImportance.js";
import { FactPlatform } from "../Domain/ValueObjects/FactPlatform.js";
import type { Redaction } from "../Domain/ValueObjects/Redaction.js";
import { RedactionStrategy } from "../Domain/ValueObjects/RedactionStrategy.js";
import { FactsDefinitionSchemaPrimitives } from "./FactsDefinitionSchemaPrimitives.js";

type FactCommonSettings = {
  id: FactId;
} & FactSettings;

type FactSettingsProperties = {
  [TKey in keyof FactCommonSettings]-?: ConfigSchemaNode<FactCommonSettings[TKey]>;
};

export class FactSettingsSchema {
  private readonly primitives: FactsDefinitionSchemaPrimitives;

  constructor(private readonly schema: ConfigSchema) {
    this.primitives = new FactsDefinitionSchemaPrimitives(schema);
  }

  properties(): FactSettingsProperties {
    return {
      id: this.primitives.factId(),
      importance: this.schema.defaulted(this.schema.enum(FactImportance), FactImportance.Required),
      platforms: this.schema.optional(this.schema.array(this.schema.enum(FactPlatform), { nonempty: true })),
      timeoutMs: this.schema.optional(this.primitives.positiveInteger()),
      maxOutputBytes: this.schema.optional(this.primitives.positiveInteger()),
      redaction: this.schema.optional(this.redaction()),
    };
  }

  private redaction(): ConfigSchemaNode<Redaction> {
    const strategy = this.schema.enum(RedactionStrategy);

    return this.schema.union<Redaction>([
      strategy,
      this.schema.strictObject({
        strategy,
        fields: this.schema.optional(this.schema.array(this.primitives.nonEmptyString())),
        patterns: this.schema.optional(this.schema.array(this.primitives.nonEmptyString())),
      }),
    ]);
  }
}
