import type { ConfigSchema } from "../../ConfigCore/index.js";

export class FactsSchemaPrimitives {
  constructor(private readonly schema: ConfigSchema) {}

  factId() {
    return this.schema.string({
      minLength: 1,
      pattern: "^[a-z][a-z0-9._-]*$",
      patternMessage: "must start with a lowercase letter and use lowercase letters, numbers, '.', '_', or '-'",
    });
  }

  nonEmptyString() {
    return this.schema.string({
      minLength: 1,
    });
  }

  positiveInteger() {
    return this.schema.number({
      int: true,
      positive: true,
    });
  }

  nonnegativeInteger() {
    return this.schema.number({
      int: true,
      nonnegative: true,
    });
  }
}
