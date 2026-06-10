import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("FactsDefinition boundaries", () => {
  it("keeps facts definition value objects, entities, and schema in explicit folders", () => {
    const modulePath = join(process.cwd(), "src/Facts/Definition");
    const domainPath = join(modulePath, "Domain");
    const schemaPath = join(modulePath, "Schema");

    expect(readdirSync(domainPath)).toEqual(
      expect.arrayContaining(["Entities", "ValueObjects"]),
    );
    expect(readdirSync(join(domainPath, "Entities"))).toEqual(
      expect.arrayContaining(["FactsDefinition.ts", "CommandFact.ts"]),
    );
    expect(readdirSync(join(domainPath, "ValueObjects"))).toEqual(
      expect.arrayContaining(["FactImportance.ts", "FactPlatform.ts", "FactSettings.ts"]),
    );
    expect(readdirSync(schemaPath)).toEqual(
      expect.arrayContaining([
        "FactsDefinitionSchemaPrimitives.ts",
        "FactSettingsSchema.ts",
        "FactInputSchema.ts",
        "FactSectionSchemas.ts",
        "FactsDefinitionSchema.ts",
        "FactsDefinitionConfigSchema.ts",
      ]),
    );
  });
});
