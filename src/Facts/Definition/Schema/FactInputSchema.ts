import {
  type ConfigSchema,
  type ConfigSchemaNode,
} from "../../../ConfigCore/index.js";
import type { FactInput } from "../Domain/ValueObjects/FactInput.js";

export class FactInputSchema {
  constructor(private readonly schema: ConfigSchema) {}

  build(): ConfigSchemaNode<FactInput> {
    return this.schema.strictObject({
      required: this.schema.optional(this.schema.boolean()),
      default: this.schema.optional(this.schema.unknown()),
    });
  }
}
