import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Facts } from "../Facts.js";

describe("Facts public API", () => {
  it("does not expose a public barrel", () => {
    const publicBarrel = readFileSync(join(process.cwd(), "src/Modules/Facts/index.ts"), "utf8");

    expect(publicBarrel).toBe("export {};\n");
  });

  it("is entered by making an instance and nothing else", () => {
    const statics = Object.getOwnPropertyNames(Facts).filter(
      (name) => !["length", "name", "prototype"].includes(name),
    );

    expect(statics).toEqual([]);
  });

  it("offers one way to read a machine and no other", () => {
    const methods = Object.getOwnPropertyNames(Facts.prototype).filter((name) => name !== "constructor");
    const publicMethods = methods.filter((name) => /^(collect|read|inspect|gather)/.test(name));

    expect(publicMethods).toEqual(["collect"]);
  });

  it("exports one class and no other value", () => {
    const source = readFileSync(join(process.cwd(), "src/Modules/Facts/Facts.ts"), "utf8");
    const exported = [...source.matchAll(/^export\s+(class|type|function|const|let|var|interface|enum)\s+([A-Za-z0-9_]+)/gm)]
      .map((match) => ({ kind: match[1], name: match[2] }));

    expect(exported.filter((entry) => entry.kind !== "type")).toEqual([{ kind: "class", name: "Facts" }]);
    expect(source).not.toMatch(/^export\s+\{/m);
  });

  it("reads a machine through a method, because reaching one means waiting", async () => {
    const machine = await new Facts().collect({
      target: { name: "host", scope: "host", type: "host", transport: "local" },
      declare: { sections: ["os"] },
    });

    expect(machine.snapshot.target.id).toBe("host");
  });

  it("hands back what it read rather than being it", () => {
    expect(Array.isArray(new Facts())).toBe(false);
    expect(Facts.prototype instanceof Array).toBe(false);
  });
});
