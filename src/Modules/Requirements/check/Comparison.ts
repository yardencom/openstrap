import { isDeepStrictEqual } from "node:util";

import { Assertions } from "./Assertions.js";
import { satisfies, valid, validRange } from "semver";

import type { Comparisons } from "#types/Requirements.js";

/** The words a requirement may use instead of a value, and the whole of them. */
const assertionKeys = new Set([
  "const",
  "enum",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "contains",
]);

/** One thing a requirement expects, against one thing the machine reported. */
export class Comparison {
  /** @param field The name of the field being compared. */
  constructor(
    private readonly field: string,
    private readonly expected: unknown,
    private readonly actual: unknown,
  ) {}

  /** Whether this is a condition rather than a value to match exactly. */
  static isAssertion(value: unknown): value is Record<string, unknown> {
    return Comparison.isRecord(value) && Object.keys(value).some((key) => assertionKeys.has(key));
  }

  result(): Comparisons {
    if (this.field === "version" && typeof this.expected === "string" && validRange(this.expected)) {
      return this.version(this.expected);
    }

    if (Comparison.isAssertion(this.expected)) {
      return new Assertions(this.expected, this.actual).result();
    }

    return { status: isDeepStrictEqual(this.actual, this.expected) ? "passed" : "failed" };
  }

  private version(range: string): Comparisons {
    if (typeof this.actual !== "string" || !valid(this.actual)) {
      return {
        status: "error",
        message: `version expected ${range}, got non-SemVer value ${JSON.stringify(this.actual)}`,
      };
    }

    return {
      status: satisfies(this.actual, range) ? "passed" : "failed",
      message: `version expected ${range}, got ${this.actual}`,
    };
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }
}
