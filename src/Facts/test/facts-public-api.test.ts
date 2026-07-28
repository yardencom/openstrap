import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Facts } from "../Facts.js";

describe("Facts public API", () => {
  it("does not expose a public barrel", () => {
    const publicBarrel = readFileSync(join(process.cwd(), "src/Facts/index.ts"), "utf8");

    expect(publicBarrel).toBe("export {};\n");
  });

  it("is entered by making an instance and nothing else", () => {
    const statics = Object.getOwnPropertyNames(Facts).filter(
      (name) => !["length", "name", "prototype"].includes(name),
    );

    expect(statics).toEqual([]);
  });

  it("offers reading a machine, and reading it against a definition file", () => {
    const facts = new Facts();

    expect(typeof facts.collect).toBe("function");
    expect(typeof facts.collectFromDefinition).toBe("function");
  });

  it("exports one class and no other value", () => {
    const source = readFileSync(join(process.cwd(), "src/Facts/Facts.ts"), "utf8");
    const exported = [...source.matchAll(/^export\s+(class|type|function|const|let|var|interface|enum)\s+([A-Za-z0-9_]+)/gm)]
      .map((match) => ({ kind: match[1], name: match[2] }));

    expect(exported.filter((entry) => entry.kind !== "type")).toEqual([{ kind: "class", name: "Facts" }]);
    expect(source).not.toMatch(/^export\s+\{/m);
  });

  it("reads a machine through a method, because reaching one means waiting", async () => {
    const facts = await new Facts().collect({
      target: { name: "host", scope: "host", type: "host", transport: "local" },
      declare: { sections: ["os"] },
    });

    expect(facts).toHaveLength(1);
    expect(facts[0]!.snapshot.target.id).toBe("host");
  });

  it("hands back a collection rather than being one", () => {
    expect(Array.isArray(new Facts())).toBe(false);
    expect(Facts.prototype instanceof Array).toBe(false);
  });
});
