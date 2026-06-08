import { describe, expect, it } from "vitest";

import { exampleConfigCore, exampleDefinition } from "./config-core-test-fixtures.js";

describe("ConfigCore JSON Schema emission", () => {
  it("generates JSON Schema without requiring fields that have runtime defaults", () => {
    const jsonSchema = exampleConfigCore.emitJsonSchema(exampleDefinition);
    const schemaText = JSON.stringify(jsonSchema);

    expect(schemaText).toContain("https://openstrap.dev/schemas/example.schema.json");
    expect(schemaText).not.toContain('"mode"]');
    expect(schemaText).not.toContain('"capture"]');
  });
});
