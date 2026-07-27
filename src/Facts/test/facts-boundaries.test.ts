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

  it("keeps facts-specific concepts inside one Facts module", () => {
    const factsPath = join(process.cwd(), "src/Facts");
    const factsEntries = readdirSync(factsPath);
    const publicBarrel = readFileSync(join(factsPath, "index.ts"), "utf8");

    expect(factsEntries).toEqual(
      expect.arrayContaining(["Application", "Collectors", "Definition", "Domain", "SchemaArtifacts"]),
    );
    expect(publicBarrel).toBe("export {};\n");
    expect(publicBarrel).not.toContain("CollectFactsFromDefinition");
    expect(publicBarrel).not.toContain("FactsDefinitionJsonSchema");
    expect(publicBarrel).not.toContain("FactsDefinitionReader");
  });

  it("keeps Facts/Facts as the only import path from other modules", () => {
    const nonFactsSourcePaths = listSourceFiles(join(process.cwd(), "src")).filter(
      (filePath: string) => !filePath.includes("/src/Facts/"),
    );
    const offenders = nonFactsSourcePaths.filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      const imports = [...source.matchAll(/from\s+["']([^"']*Facts\/[^"']+)["']/g)];

      return imports.some((match) => !match[1]!.endsWith("/Facts.js"));
    });

    expect(offenders).toEqual([]);
  });

  it("allows consumers to import only the Facts class from Facts/Facts", () => {
    const nonFactsSourcePaths = listSourceFiles(join(process.cwd(), "src")).filter(
      (filePath: string) => !filePath.includes("/src/Facts/"),
    );
    const offenders = nonFactsSourcePaths.filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      const imports = [...source.matchAll(/import\s+\{([^}]+)\}\s+from\s+["'][^"']*Facts\/Facts\.js["']/g)];

      return imports.some((match) => {
        const names = match[1]!
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean);

        return names.length !== 1 || names[0] !== "Facts";
      });
    });

    expect(offenders).toEqual([]);
  });

  it("keeps obsolete facts top-level modules out of the repository", () => {
    const rootEntries = readdirSync(join(process.cwd(), "src"));

    expect(rootEntries).not.toContain("FactsDefinition");
    expect(rootEntries).not.toContain("FactsDefinitionCollection");
    expect(rootEntries).not.toContain("SchemaArtifacts");
  });

  it("keeps obsolete application names out of the facts module", () => {
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

  it("does not import facts adapters outside the Facts module", () => {
    const nonFactsSourcePaths = listSourceFiles(join(process.cwd(), "src")).filter(
      (filePath: string) => !filePath.includes("/src/Facts/"),
    );
    const offenders = nonFactsSourcePaths.filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      return /Facts\/Adapters/.test(source);
    });

    expect(offenders).toEqual([]);
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
