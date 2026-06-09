import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Facts boundaries", () => {
  it("keeps Facts independent from Zod and concrete adapters", () => {
    const factsSourcePaths = listSourceFiles(join(process.cwd(), "src/Facts")).filter(
      (filePath: string) => !filePath.includes("/test/"),
    );
    const offenders = factsSourcePaths.filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      return /\bZod\b|\bzod\b|ConfigCore\/Adapters|ConfigCore\/Platform|DefaultConfigCore|\/Composition\//.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps facts definition contracts outside the runtime facts module", () => {
    const factsPath = join(process.cwd(), "src/Facts");
    const factsEntries = readdirSync(factsPath);
    const publicBarrel = readFileSync(join(factsPath, "index.ts"), "utf8");
    const factsSources = listSourceFiles(factsPath)
      .filter((filePath: string) => !filePath.includes("/test/"))
      .map((filePath: string) => readFileSync(filePath, "utf8"));

    expect(factsEntries).not.toContain("Schema");
    expect(publicBarrel).not.toContain("FactsDefinition");
    expect(publicBarrel).not.toContain("FactsRunResultStore");
    expect(factsSources.join("\n")).not.toContain("../FactsDefinition/Schema");
  });

  it("keeps orchestration and storage outside the facts module", () => {
    const factsPath = join(process.cwd(), "src/Facts");
    const applicationPath = join(factsPath, "Application");

    if (existsSync(applicationPath)) {
      expect(readdirSync(applicationPath)).not.toEqual(
        expect.arrayContaining([
          "FactCollectionPlanner.ts",
          "FactsDefinitionCollector.ts",
          "FactsResultStore.ts",
        ]),
      );
    }
  });
});

function listSourceFiles(directoryPath: string): string[] {
  return readdirSync(directoryPath).flatMap((entryName) => {
    const entryPath = join(directoryPath, entryName);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      return listSourceFiles(entryPath);
    }

    return entryPath.endsWith(".ts") ? [entryPath] : [];
  });
}
