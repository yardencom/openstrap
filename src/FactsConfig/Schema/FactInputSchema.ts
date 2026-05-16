import {
  configSchema,
  type ConfigSchemaNodeDto,
  type ConfigSchemaRefinementContextDto,
} from "../../ConfigCore/index.js";
import { FactsConfigPrimitives } from "./FactsConfigPrimitives.js";

export class FactInputSchema {
  static build(): ConfigSchemaNodeDto {
    return configSchema.discriminatedUnion("type", {
      string: this.inputVariantSchema("string", configSchema.string()),
      path: this.inputVariantSchema("path", configSchema.string()),
      number: this.inputVariantSchema("number", configSchema.number()),
      boolean: this.inputVariantSchema("boolean", configSchema.boolean()),
      enum: this.enumInputSchema(),
      array: this.inputVariantSchema("array", configSchema.array(configSchema.unknown())),
    });
  }

  private static inputVariantSchema(type: string, defaultSchema: ConfigSchemaNodeDto) {
    return configSchema.strictObject({
      ...this.inputBaseSchema(type),
      default: configSchema.optional(defaultSchema),
    });
  }

  private static enumInputSchema() {
    return configSchema.refine(
      configSchema.strictObject({
        ...this.inputBaseSchema("enum"),
        values: configSchema.array(FactsConfigPrimitives.nonEmptyString(), { nonempty: true }),
        default: configSchema.optional(configSchema.string()),
      }),
      this.validateEnumDefault,
    );
  }

  private static inputBaseSchema(type: string): Record<string, ConfigSchemaNodeDto> {
    return {
      type: configSchema.literal(type),
      required: configSchema.optional(configSchema.boolean()),
    };
  }

  private static validateEnumDefault(input: unknown, context: ConfigSchemaRefinementContextDto): void {
    const enumInput = input as { values: string[]; default?: string };

    if (enumInput.default !== undefined && !enumInput.values.includes(enumInput.default)) {
      context.addIssue({
        message: "enum input default must be one of values",
        path: ["default"],
        code: "custom",
      });
    }
  }
}
