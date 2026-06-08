import { describe, expect, it } from "vitest";

import { ConfigCore } from "../index.js";

enum ExampleStringEnum {
  One = "one",
  Two = "two",
}

describe("ConfigSchema", () => {
  it("accepts string enums without caller-side Object.values conversion", () => {
    const configCore = new ConfigCore();
    const schema = configCore.schema;
    const definition = schema.define<{ value: string }>({
      kind: "enum.config",
      schemaId: "https://openstrap.dev/schemas/enum.schema.json",
      title: "Enum config",
      description: "Enum config",
      rootSchema: schema.strictObject({
        value: schema.enum(ExampleStringEnum),
      }),
    });

    expect(configCore.load(definition, { mode: "inline", content: "value: one" })).toEqual({
      value: "one",
    });
  });
});
