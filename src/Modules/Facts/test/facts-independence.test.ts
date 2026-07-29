import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/** The one name the module answers to. */
const doors = ["/Facts.js"];

/**
 * The rule this file exists for: imagine openstrap does not exist. Does the module still make sense?
 * It has to be liftable into a package of its own without a line rewritten.
 */
const openstrapModules = [
  "Blueprint", "Plugin", "Requirements", "ConfigCore", "Transport", "RemoteOpenStrap",
  "StateStore", "Create", "Connect", "LockFile", "Secrets", "RunLock", "CLI",
];

describe("Facts is a module of its own", () => {
  it("does not know that blueprints, plugins, transports or runs exist", () => {
    const offenders = factsSources().filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");

      return openstrapModules.some((name) => new RegExp(`from\\s+["'][^"']*\\.\\./${name}/`).test(source));
    });

    expect(offenders.map(relative)).toEqual([]);
  });

  it("reaches outside itself for nothing at all", () => {
    const factsRoot = join(process.cwd(), "src/Modules/Facts");
    const offenders = factsSources().filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");

      return [...source.matchAll(/from\s+["'](\.[^"']+)["']/g)]
        .map((match) => resolve(dirname(filePath), match[1]!))
        .some((target) => !target.startsWith(`${factsRoot}/`));
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

      return imports.some((match) => !doors.some((door) => match[1]!.endsWith(door)));
    });

    expect(offenders.map(relative)).toEqual([]);
  });
});

/**
 * One collection, wherever the machine is.
 *
 * A host read through the host's own APIs and a guest read by parsing the output of the guest's own
 * programs would be two implementations of the same thing, and they would drift. openstrap shipped
 * that mistake once, and the symptom was a guest snapshot that could not be compared with a host one.
 *
 * What prevents it: collecting that uses the machine's own APIs and runs on the machine, and — kept
 * entirely apart from it — openstrap delivering itself to machines it is not running on. These tests
 * hold the two apart, because the moment either takes on the other's job there are two implementations
 * again.
 */
describe("Collecting facts", () => {
  it("reads through the machine's own APIs", () => {
    const throughApis = collectSources().filter((filePath: string) =>
      /from\s+["'](node:(child_process|os|fs)|systeminformation|which)["']/.test(readFileSync(filePath, "utf8")),
    );

    expect(throughApis.length).toBeGreaterThan(0);
  });

  it("never takes a channel of access, because it runs where the machine is", () => {
    const offenders = factsSources().filter((filePath: string) =>
      /Transport\/|TransportConnection|processes\.capture/.test(readFileSync(filePath, "utf8")),
    );

    expect(offenders.map(relative)).toEqual([]);
  });

  it("never varies by where it is running", () => {
    const offenders = factsSources().filter((filePath: string) =>
      /\b(isLocal|isRemote|isSsh|overSsh|localOnly|isGuest|isHost)\b/.test(readFileSync(filePath, "utf8")),
    );

    expect(offenders.map(relative)).toEqual([]);
  });

  it("is built out of classes", () => {
    const sources = factsSources().filter((filePath: string) => !filePath.includes("/domain/"));

    expect(sources.length).toBeGreaterThan(4);

    for (const filePath of sources) {
      expect(readFileSync(filePath, "utf8"), relative(filePath)).toMatch(/export class \w+/);
    }
  });

  it("names nothing with a suffix the project forbids", () => {
    const banned = /class \w*(Orchestration|Orchestrator|Factory|Manager|Helper|Util|Service|Handler|Processor)\b/;
    const offenders = factsSources().filter((filePath: string) => banned.test(readFileSync(filePath, "utf8")));

    expect(offenders.map(relative)).toEqual([]);
  });

  it("reads through an api, never in a constructor", () => {
    const offenders = factsSources().filter((filePath: string) =>
      /await |\.collect\(|\.read\(/.test(constructorBodyIn(readFileSync(filePath, "utf8"))),
    );

    expect(offenders.map(relative)).toEqual([]);
  });
});

describe("openstrap delivering itself", () => {
  it("collects no facts of its own", () => {
    const offenders = deliverySources().filter((filePath: string) =>
      /from\s+["'](systeminformation|which|node:os)["']|Facts\/Collect\//.test(readFileSync(filePath, "utf8")),
    );

    expect(offenders.map(relative)).toEqual([]);
  });

  it("sends openstrap and asks openstrap, rather than shipping a program of its own", () => {
    const source = readFileSync(join(process.cwd(), "src/RemoteOpenStrap/RemoteOpenStrap.ts"), "utf8");

    expect(source).toMatch(/"facts",\s*"collect"/);
  });

  it("delivers what a person installs, so there is no second program to keep in step", () => {
    const build = readFileSync(join(process.cwd(), "build/binaries.ts"), "utf8");

    // One build, one list of platforms: the machine openstrap is installed on and the machines it
    // delivers itself to are built the same way, from the entry point a person runs.
    expect(build).toMatch(/"src",\s*"CLI",\s*"index\.ts"/);
    expect(build).toMatch(/darwin-arm64[\s\S]*linux-arm64/);
  });
});

/**
 * What a constructor actually does, braces balanced.
 *
 * Counted rather than matched: an empty constructor followed by a method would otherwise read as a
 * constructor containing that method, and the test would report the opposite of the truth.
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

/** Everything the module is made of: the facade, the model and the collectors. */
function factsSources(): string[] {
  return [
    join(process.cwd(), "src/Modules/Facts/Facts.ts"),
    ...listSources(join(process.cwd(), "src/Modules/Facts/domain")),
    ...collectSources(),
  ].filter((filePath: string) => !filePath.includes(".test."));
}

/** What reads the machine. */
function collectSources(): string[] {
  return listSources(join(process.cwd(), "src/Modules/Facts/collect"))
    .filter((filePath: string) => !filePath.includes(".test."));
}

/** What gets openstrap to a machine it is not running on. */
function deliverySources(): string[] {
  return listSources(join(process.cwd(), "src/RemoteOpenStrap"))
    .filter((filePath: string) => !filePath.includes(".test."));
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
