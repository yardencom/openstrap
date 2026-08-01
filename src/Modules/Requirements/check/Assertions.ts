import { isDeepStrictEqual } from "node:util";

import type { Comparisons } from "#types/Requirements.js";

/**
 * A condition written out: what has to be true of the value, rather than what the value is.
 *
 * Several may be written together — `minimum` with `multipleOf` — and all of them are checked, so
 * the message says everything that is wrong rather than the first thing.
 */
export class Assertions {
  private readonly failures: string[] = [];

  constructor(private readonly expected: Record<string, unknown>, private readonly actual: unknown) {}

  result(): Comparisons {
    const wrongType = this.exact() ?? this.numeric() ?? this.list() ?? this.text();

    if (wrongType) {
      return wrongType;
    }

    return this.failures.length === 0
      ? { status: "passed" }
      : { status: "failed", message: this.failures.join("; ") };
  }

  private exact(): Comparisons | undefined {
    if ("const" in this.expected && !isDeepStrictEqual(this.actual, this.expected.const)) {
      this.failures.push(`expected const ${JSON.stringify(this.expected.const)}`);
    }

    if (!("enum" in this.expected)) {
      return undefined;
    }

    if (!Array.isArray(this.expected.enum)) {
      return { status: "error", message: "enum assertion must be an array" };
    }

    if (!this.expected.enum.some((value) => isDeepStrictEqual(value, this.actual))) {
      this.failures.push(`expected enum ${JSON.stringify(this.expected.enum)}`);
    }

    return undefined;
  }

  private numeric(): Comparisons | undefined {
    const keys = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"] as const;

    if (!keys.some((key) => key in this.expected)) {
      return undefined;
    }

    if (typeof this.actual !== "number") {
      return { status: "error", message: `numeric assertion expected number, got ${typeof this.actual}` };
    }

    const actual = this.actual;
    const bounds: Array<[typeof keys[number], (limit: number) => boolean]> = [
      ["minimum", (limit) => actual < limit],
      ["maximum", (limit) => actual > limit],
      ["exclusiveMinimum", (limit) => actual <= limit],
      ["exclusiveMaximum", (limit) => actual >= limit],
      ["multipleOf", (limit) => actual % limit !== 0],
    ];

    for (const [key, broken] of bounds) {
      const limit = this.expected[key];

      if (typeof limit === "number" && broken(limit)) {
        this.failures.push(`expected ${key} ${limit}`);
      }
    }

    return undefined;
  }

  /**
   * A list is checked for membership, not for equality: a requirement says the account is in `sudo`,
   * and which other groups it is in is not the question.
   */
  private list(): Comparisons | undefined {
    if (!("contains" in this.expected)) {
      return undefined;
    }

    if (!Array.isArray(this.actual)) {
      return { status: "error", message: `contains assertion expected a list, got ${typeof this.actual}` };
    }

    if (!this.actual.some((value) => isDeepStrictEqual(value, this.expected.contains))) {
      this.failures.push(`expected contains ${JSON.stringify(this.expected.contains)}`);
    }

    return undefined;
  }

  private text(): Comparisons | undefined {
    const keys = ["minLength", "maxLength", "pattern"] as const;

    if (!keys.some((key) => key in this.expected)) {
      return undefined;
    }

    if (typeof this.actual !== "string") {
      return { status: "error", message: `string assertion expected string, got ${typeof this.actual}` };
    }

    const { minLength, maxLength, pattern } = this.expected;

    if (typeof minLength === "number" && this.actual.length < minLength) {
      this.failures.push(`expected minLength ${minLength}`);
    }

    if (typeof maxLength === "number" && this.actual.length > maxLength) {
      this.failures.push(`expected maxLength ${maxLength}`);
    }

    if (typeof pattern === "string" && !new RegExp(pattern).test(this.actual)) {
      this.failures.push(`expected pattern ${pattern}`);
    }

    return undefined;
  }
}
