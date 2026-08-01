import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** Where the shape a plugin implements lives: a package of its own, so a plugin needs no openstrap. */
const contractRoot = join(process.cwd(), "contract");

describe("Plugin boundaries", () => {
  /**
   * openstrap owns no implementation of a transport.
   *
   * It had one — `LocalTransport`, access to the machine openstrap runs on — and by the time both
   * of the decisions above had landed nothing called it. Facts are read on the machine through the
   * machine's own APIs (ADR 0007), so reading the host needs no channel; and a plugin may not take
   * an implementation out of openstrap (ADR 0008), so the last caller stopped being one. What is
   * left of a transport in openstrap is the contract, which is where it belongs.
   */
  it("keeps no implementation of a transport of its own", () => {
    const offenders = listSourceFiles(join(process.cwd(), "src")).filter((filePath: string) =>
      /class \w*(Transport|FileSystem|Processes|Network)\b/.test(readFileSync(filePath, "utf8")),
    );

    expect(offenders.map(relative)).toEqual([]);
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

function relative(filePath: string): string {
  return filePath.slice(process.cwd().length + 1);
}
