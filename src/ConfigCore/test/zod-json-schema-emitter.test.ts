import { describe, expect, it } from "vitest";

import { ZodJsonSchemaEmitter } from "../Adapters/ZodJsonSchemaEmitter.js";
import { exampleDefinition } from "./config-core-test-fixtures.js";

describe("ZodJsonSchemaEmitter", () => {
  it("generates JSON Schema without requiring fields that have runtime defaults", () => {
    const jsonSchema = new ZodJsonSchemaEmitter().emit(exampleDefinition);
    const schemaText = JSON.stringify(jsonSchema);

    expect(schemaText).toContain("https://openstrap.dev/schemas/example.schema.json");
    expect(schemaText).not.toContain('"mode"]');
    expect(schemaText).not.toContain('"capture"]');
  });
});
