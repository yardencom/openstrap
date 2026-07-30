import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** The one name the module answers to. */
const doors = ["/Facts.js"];

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

    // No `types` of its own: what facts are is the project's vocabulary, in `src/types`. What is
    // here is how they are collected.
    expect(factsEntries).toEqual(expect.arrayContaining(["collect"]));
    expect(factsEntries).not.toContain("types");
    expect(publicBarrel).toBe("export {};\n");
    expect(factsEntries).not.toContain("Application");
    // No local case and no remote case: there is one way to collect, so there is nothing to choose
    // between and no reading to pick.
    expect(factsEntries).not.toContain("Reading");
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

      return imports.some((match) => !doors.some((door) => match[1]!.endsWith(door)));
    });

    expect(offenders).toEqual([]);
  });

  it("lets consumers import only what the facade offers", () => {
    const offered = new Set([
      "Facts", "FactOrder", "FactChannel", "Target", "FactDeclaration", "FactSnapshot",
      "Asked", "FactSections", "FactsStatus", "everySection",
    ]);
    const nonFactsSourcePaths = listSourceFiles(join(process.cwd(), "src")).filter(
      (filePath: string) => !filePath.includes("/src/Modules/Facts/"),
    );
    const offenders = nonFactsSourcePaths.filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      const imports = [...source.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["'][^"']*Facts\/Facts\.js["']/g)];

      return imports.some((match) => match[1]!
        .split(",")
        .map((name) => name.trim().replace(/^type\s+/, ""))
        .filter(Boolean)
        .some((name) => !offered.has(name)));
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
