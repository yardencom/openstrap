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

/**
 * One thing a requirement expects, against one thing the machine reported.
 *
 * The whole of the assertion language lives here and nowhere else: written flat, a requirement means
 * "exactly this"; written as an object with one of the words above, it means a condition. Which of
 * the two it is is the only question this class asks before it starts comparing.
 *
 * A type that does not fit the assertion is an error rather than a failure — `minimum` against a
 * string is a blueprint that asks a question of the wrong thing, and calling that "the machine does
 * not comply" would blame the machine for it.
 */
export class Comparison {
  /**
   * @param field The name of the field being compared. Only one field is read differently from the
   * rest: `version`, where a plain string is a SemVer range rather than the text to match. `">=24"`
   * as an exact string would never match any version anyone has.
   */
  constructor(
    private readonly field: string,
    private readonly expected: unknown,
    private readonly actual: unknown,
  ) {}

  /** Whether this is a condition rather than a value to match exactly. */
  static isAssertion(value: unknown): value is Record<string, unknown> {
    return isRecord(value) && Object.keys(value).some((key) => assertionKeys.has(key));
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
