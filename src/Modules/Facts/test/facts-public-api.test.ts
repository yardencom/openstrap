import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Facts } from "../Facts.js";

const source = readFileSync(join(process.cwd(), "src/Modules/Facts/Facts.ts"), "utf8");

describe("Facts public API", () => {
  it("does not expose a public barrel", () => {
    const publicBarrel = readFileSync(join(process.cwd(), "src/Modules/Facts/index.ts"), "utf8");

    expect(publicBarrel).toBe("export {};\n");
  });

  it("is entered by collecting, and cannot be made any other way", () => {
    const entries = Object.getOwnPropertyNames(Facts).filter(
      (name) => !["length", "name", "prototype"].includes(name),
    );

    // `of` is the other way facts come to exist: read back from what openstrap printed on a machine it
    // delivered itself to. Both go through the same private constructor, so nothing else can assemble
    // facts out of whatever it liked.
    expect(entries.sort()).toEqual(["collect", "of"]);
    expect(source).toMatch(/private constructor\(/);
  });

  it("is the facts, rather than something handing them over", async () => {
    const facts = await Facts.collect({ declare: { sections: ["os", "arch"] } });

    expect(facts).toBeInstanceOf(Facts);
    expect(facts.os.name).not.toBe("");
    expect(facts.arch).toBe(process.arch);
  });

  it("answers for itself whether everything asked for came back", async () => {
    const clean = await Facts.collect({ declare: { sections: ["os"] } });
    // root exists, but the declaration asserts a uid it does not have.
    const failed = await Facts.collect({ declare: { users: { superuser: { name: "root", uid: 1234 } } } });

    expect(clean.status()).toBe("success");
    expect(failed.status()).toBe("warning");
  });

  it("is its sections, so the facts and their JSON are one shape", async () => {
    const facts = await Facts.collect({ declare: { sections: ["arch"] } });
    const printed = JSON.parse(JSON.stringify(facts));

    expect(printed.arch).toBe(facts.arch);
    // A method is not a section, so it never reaches the JSON.
    expect(Object.keys(printed)).not.toContain("status");
  });

  it("cannot be edited after it is collected", async () => {
    const facts = await Facts.collect({ declare: { sections: ["os"] } });

    expect(Object.isFrozen(facts)).toBe(true);
    expect(Object.isFrozen(facts.os)).toBe(true);
  });

  it("exports one class, and otherwise only types", () => {
    const exported = [...source.matchAll(/^export\s+(class|type|function|const|let|var|interface|enum)\s+([A-Za-z0-9_]+)/gm)]
      .map((match) => ({ kind: match[1], name: match[2] }));

    expect(exported.filter((entry) => !["type", "interface"].includes(entry.kind!)))
      .toEqual([{ kind: "class", name: "Facts" }]);
    // Nothing is re-exported as a value: the names a caller spells here are types, and the module's
    // other class — the snapshot — is its own file rather than something this one hands on.
    expect(source.split("\n").filter((line) => /^export\s+\{/.test(line))).toEqual([]);
  });
});
