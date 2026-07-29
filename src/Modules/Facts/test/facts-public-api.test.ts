import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Facts } from "../Facts.js";

const source = readFileSync(join(process.cwd(), "src/Modules/Facts/Facts.ts"), "utf8");
const host = { name: "host", scope: "host", type: "host" } as const;

describe("Facts public API", () => {
  it("does not expose a public barrel", () => {
    const publicBarrel = readFileSync(join(process.cwd(), "src/Modules/Facts/index.ts"), "utf8");

    expect(publicBarrel).toBe("export {};\n");
  });

  it("is entered by collecting, and facts cannot be made any other way", () => {
    const reachable = [...source.matchAll(/^ {2}(?!private)(?:static )?(?:async )?(\w+)\(/gm)].map((match) => match[1]);

    // `printed` is the other way a snapshot comes to exist here: read back from what openstrap
    // printed on a machine it delivered itself to. Everything that makes facts goes through the same
    // private constructor, so nothing else can assemble facts out of whatever it liked.
    expect(reachable).toEqual(["collect", "printed", "status"]);
    expect(source).toMatch(/private constructor\(/);
  });

  it("makes the facts it collected an instance of itself, and names them", async () => {
    const snapshot = await Facts.collect({ target: host, declare: { sections: ["os", "arch"] } });

    expect(snapshot.facts).toBeInstanceOf(Facts);
    expect(snapshot.facts.os.name).not.toBe("");
    expect(snapshot.facts.arch).toBe(process.arch);
    expect(String(snapshot.id)).toMatch(/^snap_host_/);
  });

  it("answers for itself whether everything asked for came back", async () => {
    const clean = await Facts.collect({ target: host, declare: { sections: ["os"] } });
    // root exists, but the declaration asserts a uid it does not have.
    const failed = await Facts.collect({ target: host, declare: { users: { superuser: { name: "root", uid: 1234 } } } });

    expect(clean.facts.status()).toBe("success");
    expect(failed.facts.status()).toBe("warning");
  });

  it("is its sections, so the facts and their JSON are one shape", async () => {
    const { facts } = await Facts.collect({ target: host, declare: { sections: ["arch"] } });
    const printed = JSON.parse(JSON.stringify(facts));

    expect(printed.arch).toBe(facts.arch);
    // A method is not a section, so it never reaches the JSON.
    expect(Object.keys(printed)).not.toContain("status");
  });

  it("cannot be edited after it is collected", async () => {
    const { facts } = await Facts.collect({ target: host, declare: { sections: ["os"] } });

    expect(Object.isFrozen(facts)).toBe(true);
    expect(Object.isFrozen(facts.os)).toBe(true);
  });

  it("is one class in a file, and the file is named after it", () => {
    const exported = [...source.matchAll(/^export\s+(class|type|function|const|let|var|interface|enum)\s+([A-Za-z0-9_]+)/gm)]
      .map((match) => ({ kind: match[1], name: match[2] }));

    expect(exported.filter((entry) => !["type", "interface"].includes(entry.kind!)))
      .toEqual([{ kind: "class", name: "Facts" }]);
    // Nothing is re-exported as a value: the other names a caller spells are types.
    expect(source.split("\n").filter((line) => /^export\s+\{/.test(line))).toEqual([]);
  });

  it("keeps one class to a file across the module", () => {
    const files = sourcesIn(join(process.cwd(), "src/Modules/Facts"))
      .filter((path) => !path.includes(".test."));
    const crowded = files.filter((path) =>
      [...readFileSync(path, "utf8").matchAll(/^(?:export )?(?:abstract )?class /gm)].length > 1,
    );

    expect(crowded).toEqual([]);
  });
});

function sourcesIn(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    return statSync(path).isDirectory() ? sourcesIn(path) : path.endsWith(".ts") ? [path] : [];
  });
}
