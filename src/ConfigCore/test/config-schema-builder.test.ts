import { describe, expect, it } from "vitest";

import { configSchema } from "../index.js";

enum ExampleStringEnum {
  One = "one",
  Two = "two",
}

describe("configSchema", () => {
  it("accepts string enums without caller-side Object.values conversion", () => {
    expect(configSchema.enum(ExampleStringEnum)).toEqual({
      kind: "enum",
      values: ["one", "two"],
    });
  });
});
