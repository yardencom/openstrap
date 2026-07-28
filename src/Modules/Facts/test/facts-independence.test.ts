import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The rule this file exists for: imagine openstrap does not exist. Does the
 * module still make sense? It has to be liftable into a package of its own
 * without a line rewritten.
 *
 * The rule is checked against fact collection — the facade, the domain and the
 * readings. `Definition/` is not covered because it is not fact collection: it is
 * the YAML config format, it depends on ConfigCore by design, and it belongs in a
 * module of its own. That move is outstanding work, not a licence for the
 * collection core to acquire the same dependencies.
 */
const openstrapModules = [
  "Blueprint", "Plugin", "Requirements", "ConfigCore",
  "StateStore", "Create", "Connect", "LockFile", "Secrets", "RunLock", "CLI", "Export",
];

describe("Facts is a module of its own", () => {
  it("does not know that blueprints, plugins or runs exist", () => {
    const offenders = collectionSources().filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");

      return openstrapModules.some((name) => new RegExp(`from\\s+["'][^"']*\\.\\./${name}/`).test(source));
    });

    expect(offenders.map(relative)).toEqual([]);
  });

  it("reaches outside itself only for the transport ports", () => {
    const factsRoot = join(process.cwd(), "src/Modules/Facts");
    const offenders = collectionSources().filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");

      return [...source.matchAll(/from\s+["'](\.[^"']+)["']/g)]
        .map((match) => resolve(dirname(filePath), match[1]!))
        .filter((target) => !target.startsWith(`${factsRoot}/`))
        .some((target) => target !== join(process.cwd(), "src/Transport/index.js"));
    });

    expect(offenders.map(relative)).toEqual([]);
  });

  it("is reached from other modules only through its facade", () => {
    const outside = listSources(join(process.cwd(), "src")).filter(
      (filePath: string) => !filePath.includes("/src/Modules/Facts/"),
    );
    const offenders = outside.filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      const imports = [...source.matchAll(/from\s+["']([^"']*Facts\/[^"']+)["']/g)];

      return imports.some((match) => !match[1]!.endsWith("/Facts.js"));
    });

    expect(offenders.map(relative)).toEqual([]);
  });
});

/**
 * One reading, wherever the machine is.
 *
 * A host read through the host's own APIs and a guest read by parsing the output
 * of the guest's programs would be two implementations of the same thing, and
 * they would drift. openstrap shipped that mistake once, and the symptom was a
 * guest snapshot that could not be compared with a host one.
 *
 * What prevents it: one reading that uses the machine's own APIs and runs on the
 * machine, plus a delivery mechanism that gets it there. These tests hold the two
 * apart, because the moment either takes on the other's job there are two
 * implementations again.
 */
describe("Reading a machine", () => {
  it("reads through the machine's own APIs", () => {
    const throughApis = localSources().filter((filePath: string) =>
      /from\s+["'](node:(child_process|os|fs)|systeminformation|which)["']/.test(readFileSync(filePath, "utf8")),
    );

    expect(throughApis.length).toBeGreaterThan(0);
  });

  it("never takes a channel of access, because it runs where the machine is", () => {
    const offenders = localSources().filter((filePath: string) =>
      /Transport/.test(readFileSync(filePath, "utf8")),
    );

    expect(offenders.map(relative)).toEqual([]);
  });

  it("never reads the host and calls it the target", () => {
    const offenders = remoteSources().filter((filePath: string) =>
      /from\s+["'](systeminformation|which|node:os)["']/.test(readFileSync(filePath, "utf8")),
    );

    expect(offenders.map(relative)).toEqual([]);
  });

  it("has the agent run the same reading the host runs", () => {
    const agent = readFileSync(join(process.cwd(), "src/Modules/Facts/Reading/Agent/AgentMain.ts"), "utf8");

    expect(agent).toMatch(/import\s+\{\s*LocalReading\s*\}/);
    expect(agent).not.toMatch(/systeminformation|node:os|Transport/);
  });

  it("varies by operating system and never by how the machine is reached", () => {
    const offenders = readingSources().filter((filePath: string) =>
      /\b(isLocal|isRemote|isSsh|overSsh|localOnly|isGuest|isHost)\b/.test(readFileSync(filePath, "utf8")),
    );

    expect(offenders.map(relative)).toEqual([]);
  });

  it("builds every reading as a class", () => {
    // The port is a declaration and the two agent files are entry points: an
    // executable's main and the script that builds it.
    const readings = readingSources().filter((filePath: string) =>
      !filePath.endsWith("Reading/SystemReading.ts") &&
      !filePath.endsWith("Agent/AgentMain.ts") &&
      !filePath.endsWith("Agent/BuildAgent.ts"),
    );

    expect(readings.length).toBeGreaterThan(4);

    for (const filePath of readings) {
      expect(readFileSync(filePath, "utf8"), relative(filePath)).toMatch(/export class \w+/);
    }
  });

  it("names nothing with a suffix the project forbids", () => {
    const banned = /class \w*(Orchestration|Orchestrator|Factory|Manager|Helper|Util|Service|Handler|Processor)\b/;
    const offenders = collectionSources().filter((filePath: string) => banned.test(readFileSync(filePath, "utf8")));

    expect(offenders.map(relative)).toEqual([]);
  });

  it("reads through an api, never in a constructor", () => {
    const offenders = readingSources().filter((filePath: string) =>
      /await |\.collect\(|\.read\(/.test(constructorBodyIn(readFileSync(filePath, "utf8"))),
    );

    expect(offenders.map(relative)).toEqual([]);
  });
});

/**
 * What a constructor actually does, braces balanced.
 *
 * Counted rather than matched: an empty constructor followed by a method would
 * otherwise read as a constructor containing that method, and the test would
 * report the opposite of the truth.
 */
function constructorBodyIn(source: string): string {
  const opening = source.search(/constructor\([^)]*\)\s*\{/);

  if (opening === -1) {
    return "";
  }

  const start = source.indexOf("{", opening);
  let depth = 0;

  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    }

    if (source[index] === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start + 1, index);
      }
    }
  }

  return "";
}

/** The facade, the model and the readings — everything that produces a fact. */
function collectionSources(): string[] {
  return [
    join(process.cwd(), "src/Modules/Facts/Facts.ts"),
    ...listSources(join(process.cwd(), "src/Modules/Facts/Domain")),
    ...readingSources(),
  ].filter((filePath: string) => !filePath.includes(".test."));
}

function readingSources(): string[] {
  return listSources(join(process.cwd(), "src/Modules/Facts/Reading")).filter((filePath: string) => !filePath.includes(".test."));
}

/** What runs on the machine being read. */
function localSources(): string[] {
  return readingSources().filter((filePath: string) =>
    filePath.includes("/Reading/Local/") || filePath.endsWith("Reading/LocalReading.ts"),
  );
}

/** What gets the reading to a machine openstrap is not running on. */
function remoteSources(): string[] {
  return readingSources().filter((filePath: string) =>
    filePath.includes("/Reading/Remote/") || filePath.endsWith("Reading/RemoteReading.ts"),
  );
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
