import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The rule this file exists for: imagine openstrap does not exist. Does the
 * module still make sense? It has to be liftable into a package of its own
 * without a line rewritten.
 *
 * The rule is checked against fact collection — the facade, the domain and the
 * collectors. `Definition/` is not covered because it is not fact collection:
 * it is the YAML config format, it depends on ConfigCore by design, and it
 * belongs in a module of its own. That move is outstanding work, not a licence
 * for the collection core to acquire the same dependencies.
 */
const openstrapModules = [
  "Blueprint", "Plugin", "Requirements", "ConfigCore",
  "OpenStrapRun", "StateStore", "Create", "Connect", "LockFile", "Secrets", "RunLock", "CLI", "Export",
];

describe("Facts is a module of its own", () => {
  it("does not know that blueprints, plugins or runs exist", () => {
    const offenders = factsSources().filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");

      return openstrapModules.some((name) => new RegExp(`from\\s+["'][^"']*\\.\\./${name}/`).test(source));
    });

    expect(offenders.map(relative)).toEqual([]);
  });

  it("reaches outside itself only for the transport ports", () => {
    const offenders = factsSources().filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      const outward = [...source.matchAll(/from\s+["'](\.\.\/[^"']+)["']/g)]
        .map((match) => match[1]!)
        .filter((specifier) => !specifier.includes("/Facts/") && specifier.split("/").filter((part) => part === "..").length > 0);

      return outward.some((specifier) => !specifier.endsWith("Transport/index.js") && specifier.startsWith("../../"));
    });

    expect(offenders.map(relative)).toEqual([]);
  });

  it("never reads the host directly, because a guest has to answer the same way", () => {
    const offenders = collectorSources().filter((filePath: string) =>
      /from\s+["']node:(child_process|os|fs|fs\/promises)["']/.test(readFileSync(filePath, "utf8")),
    );

    expect(offenders.map(relative)).toEqual([]);
  });

  it("varies by operating system and never by how the machine is reached", () => {
    const offenders = collectorSources().filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");

      return /\b(isLocal|isRemote|isSsh|overSsh|localOnly)\b/.test(source);
    });

    expect(offenders.map(relative)).toEqual([]);
  });

  it("is reached from other modules only through its facade", () => {
    const outside = listSources(join(process.cwd(), "src")).filter(
      (filePath: string) => !filePath.includes("/src/Facts/"),
    );
    const offenders = outside.filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      const imports = [...source.matchAll(/from\s+["']([^"']*Facts\/[^"']+)["']/g)];

      return imports.some((match) => !match[1]!.endsWith("/Facts.js"));
    });

    expect(offenders.map(relative)).toEqual([]);
  });

  it("builds every collector as a class", () => {
    // Inventory.ts is the contract and the fact types — declarations, no behaviour.
    const collectors = collectorSources().filter((filePath: string) => !filePath.endsWith("Collectors/Inventory.ts"));

    expect(collectors.length).toBeGreaterThan(4);

    for (const filePath of collectors) {
      expect(readFileSync(filePath, "utf8"), relative(filePath)).toMatch(/export class \w+/);
    }
  });

  it("names nothing with a suffix the project forbids", () => {
    const banned = /class \w*(Orchestration|Orchestrator|Factory|Manager|Helper|Util|Handler|Processor)\b/;
    const offenders = factsSources().filter((filePath: string) => banned.test(readFileSync(filePath, "utf8")));

    expect(offenders.map(relative)).toEqual([]);
  });

  it("collects through an api, never in a constructor", () => {
    const offenders = collectorSources().filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      const constructorBody = source.match(/constructor\([^)]*\)\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";

      return /await |\.collect\(|\.read\(|\.run\(/.test(constructorBody);
    });

    expect(offenders.map(relative)).toEqual([]);
  });
});

function factsSources(): string[] {
  return [
    join(process.cwd(), "src/Facts/Facts.ts"),
    ...listSources(join(process.cwd(), "src/Facts/Domain")),
    ...listSources(join(process.cwd(), "src/Facts/Collectors")),
  ].filter((filePath: string) => !filePath.includes(".test."));
}

function collectorSources(): string[] {
  return listSources(join(process.cwd(), "src/Facts/Collectors")).filter((filePath: string) => !filePath.includes(".test."));
}

function relative(filePath: string): string {
  return filePath.slice(filePath.indexOf("/src/") + 1);
}

function listSources(directoryPath: string): string[] {
  return readdirSync(directoryPath).flatMap((entryName) => {
    const entryPath = join(directoryPath, entryName);

    return statSync(entryPath).isDirectory()
      ? listSources(entryPath)
      : entryPath.endsWith(".ts") ? [entryPath] : [];
  });
}
