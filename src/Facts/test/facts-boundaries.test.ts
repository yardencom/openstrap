import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { listSourceFiles } from "./facts-test-harness.js";

describe("Facts boundaries", () => {
  it("keeps Facts independent from Zod and concrete adapters", () => {
    const factsSourcePaths = listSourceFiles(join(process.cwd(), "src/Facts")).filter(
      (filePath) => !filePath.includes("/test/"),
    );
    const offenders = factsSourcePaths.filter((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return /\bZod\b|\bzod\b|ConfigCore\/Adapters|ConfigCore\/Platform|DefaultConfigCore|\/Composition\//.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps value objects and entities in explicit domain folders", () => {
    const domainPath = join(process.cwd(), "src/Facts/Domain");
    const domainEntries = readdirSync(domainPath);
    const valueObjectFiles = readdirSync(join(domainPath, "ValueObjects"));
    const entityFiles = readdirSync(join(domainPath, "Entities"));

    expect(domainEntries).toContain("ValueObjects");
    expect(domainEntries).toContain("Entities");
    expect(domainEntries).not.toContain("FactsValueObjects.ts");
    expect(domainEntries).not.toContain("FactsDefinitionEntities.ts");
    expect(domainEntries).not.toContain("FactsDefinitionDtos.ts");
    expect(entityFiles).not.toContain("CommonFactDeclarationEntity.ts");
    expect(entityFiles).not.toContain("FactDeclarationEntity.ts");
    expect(valueObjectFiles).toContain("FactImportance.ts");
    expect(valueObjectFiles).toContain("FactPlatform.ts");
    expect(valueObjectFiles).toContain("FactSettings.ts");
    expect(entityFiles).toContain("FactsDefinition.ts");
    expect(entityFiles).toContain("CommandFact.ts");
  });

  it("keeps schema contracts out of the application layer", () => {
    const factsPath = join(process.cwd(), "src/Facts");
    const schemaPath = join(factsPath, "Schema");
    const applicationPath = join(factsPath, "Application");
    const schemaFiles = readdirSync(schemaPath);

    expect(readdirSync(factsPath)).toContain("Schema");
    expect(schemaFiles).toEqual(
      expect.arrayContaining([
        "FactsSchemaPrimitives.ts",
        "FactSettingsSchema.ts",
        "FactInputSchema.ts",
        "FactSectionSchemas.ts",
        "FactsDefinitionSchema.ts",
        "FactsDefinitionConfigSchema.ts",
      ]),
    );

    if (existsSync(applicationPath)) {
      expect(readdirSync(applicationPath)).not.toEqual(
        expect.arrayContaining(["FactsDefinitionConfigSchema.ts"]),
      );
    }
  });
});
