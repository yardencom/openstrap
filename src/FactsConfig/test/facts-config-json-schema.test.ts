import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("FactsConfig JSON Schema", () => {
  it("keeps IDE JSON Schema aligned with runtime defaults", () => {
    const schema = JSON.parse(readFileSync(join(process.cwd(), "schemas/facts-definition.schema.json"), "utf8"));
    const schemaText = JSON.stringify(schema);

    expect(schemaText).not.toContain('"importance"]');
    expect(schemaText).not.toContain('"capture"]');
  });
});
