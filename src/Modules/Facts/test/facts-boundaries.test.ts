import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Facts boundaries", () => {
  it("keeps Facts independent from Zod and concrete adapters", () => {
    const factsSourcePaths = listSourceFiles(join(process.cwd(), "src/Modules/Facts")).filter(
      (filePath: string) => !filePath.includes("/test/"),
    );
    const offenders = factsSourcePaths.filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      return /\bZod\b|\bzod\b|ConfigCore\/Adapters|ConfigCore\/Platform|DefaultConfigCore|\/Composition\//.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps facts-specific concepts inside one Facts module", () => {
    const factsPath = join(process.cwd(), "src/Modules/Facts");
    const factsEntries = readdirSync(factsPath);
    const publicBarrel = readFileSync(join(factsPath, "index.ts"), "utf8");

    expect(factsEntries).toEqual(expect.arrayContaining(["Domain", "Reading"]));
    expect(publicBarrel).toBe("export {};\n");
    expect(factsEntries).not.toContain("Application");
    expect(factsEntries).not.toContain("Collectors");
    // A facts file of its own does not exist: what to read comes from the caller,
    // and the only config that says it is the blueprint, which Blueprint owns.
    expect(factsEntries).not.toContain("Definition");
    expect(factsEntries).not.toContain("SchemaArtifacts");
  });

  it("keeps Facts/Facts as the only import path from other modules", () => {
    const nonFactsSourcePaths = listSourceFiles(join(process.cwd(), "src")).filter(
      (filePath: string) => !filePath.includes("/src/Modules/Facts/"),
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
      (filePath: string) => !filePath.includes("/src/Modules/Facts/"),
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

  it("does not import facts adapters outside the Facts module", () => {
    const nonFactsSourcePaths = listSourceFiles(join(process.cwd(), "src")).filter(
      (filePath: string) => !filePath.includes("/src/Modules/Facts/"),
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
