import { configSchema } from "../../ConfigCore/index.js";

export class FactsConfigPrimitives {
  static factId() {
    return configSchema.string({
      minLength: 1,
      pattern: "^[a-z][a-z0-9._-]*$",
      patternMessage: "must start with a lowercase letter and use lowercase letters, numbers, '.', '_', or '-'",
    });
  }

  static nonEmptyString() {
    return configSchema.string({
      minLength: 1,
    });
  }

  static positiveInteger() {
    return configSchema.number({
      int: true,
      positive: true,
    });
  }

  static nonnegativeInteger() {
    return configSchema.number({
      int: true,
      nonnegative: true,
    });
  }
}
