import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** Where the shape a plugin implements lives: a package of its own, so a plugin needs no openstrap. */
const contractRoot = join(process.cwd(), "contract");

describe("Plugin boundaries", () => {
  it("reaches the transport ports only through the Transport barrel", () => {
    const offenders = pluginSourceFiles().filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      const imports = [...source.matchAll(/from\s+["']([^"']*Transport\/[^"']+)["']/g)];

      return imports.some((match) => !match[1]!.endsWith("/Transport/index.js"));
    });

    expect(offenders).toEqual([]);
  });

  it("offers no slot for reading a machine, because openstrap owns that", () => {
    const api = readFileSync(join(contractRoot, "OpenStrapPlugin.d.ts"), "utf8");

    expect(api).not.toMatch(/registerFactsBackend|facts\?:/);
    expect(readdirSync(contractRoot)).not.toContain("FactsBackend.d.ts");
    expect(readdirSync(join(process.cwd(), "src/Plugin/application"))).not.toContain("FactsBackendRegistry.ts");
  });

  it("keeps every plugin contract method asynchronous", () => {
    const contracts = ["Provider.d.ts", "Transport.d.ts", "Secret.d.ts"].map((name) =>
      readFileSync(join(contractRoot, name), "utf8"),
    );
    const methods = contracts.flatMap((source) => [...source.matchAll(/^\s{2}(\w+)\((.*?)\):\s*(.+);$/gm)]);
    const offenders = methods
      .filter((match) => !match[3]!.startsWith("Promise<"))
      .map((match) => match[1]!);

    expect(methods.map((match) => match[1]!)).toContain("create");
    expect(offenders).toEqual([]);
  });

  it("does not mention a facts backend anywhere in its barrel", () => {
    const barrel = readFileSync(join(process.cwd(), "src/Plugin/index.ts"), "utf8");

    expect(barrel).not.toContain("FactsBackend");
  });

  it("keeps the plugin registries out of other modules", () => {
    const outsidePlugin = listSourceFiles(join(process.cwd(), "src")).filter(
      (filePath: string) => !filePath.includes("/src/Plugin/"),
    );
    const offenders = outsidePlugin.filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      return /Plugin\/(Application|Domain|Core)\//.test(source);
    });

    expect(offenders).toEqual([]);
  });
});

function pluginSourceFiles(): string[] {
  return listSourceFiles(join(process.cwd(), "src/Plugin")).filter(
    (filePath: string) => !filePath.includes("/test/"),
  );
}

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
