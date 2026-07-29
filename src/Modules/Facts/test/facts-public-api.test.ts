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
    const source = readFileSync(join(process.cwd(), "src/Modules/Facts/Facts.ts"), "utf8");
    // Declared without `private`, which is the only kind of method a caller can reach.
    const reachable = [...source.matchAll(/^ {2}(?:async )?([a-z]\w*)\(/gm)].map((match) => match[1]);

    expect(reachable).toEqual(["collect"]);
  });

  it("exports one class, and otherwise only types", () => {
    const source = readFileSync(join(process.cwd(), "src/Modules/Facts/Facts.ts"), "utf8");
    const exported = [...source.matchAll(/^export\s+(class|type|function|const|let|var|interface|enum)\s+([A-Za-z0-9_]+)/gm)]
      .map((match) => ({ kind: match[1], name: match[2] }));

    expect(exported.filter((entry) => entry.kind !== "type")).toEqual([{ kind: "class", name: "Facts" }]);
    // Re-exports carry the names a caller has to spell. The one that is not a type is FactSnapshot,
    // because a snapshot openstrap took on another machine comes back as text and has to be read
    // into these types again.
    const values = source.split("\n").filter((text) => /^export\s+\{/.test(text));

    expect(values).toEqual(['export { FactSnapshot } from "./domain/FactSnapshot.js";']);
  });

  it("reads a machine through a method, because reaching one means waiting", async () => {
    const machine = await new Facts().collect({
      target: { name: "host", scope: "host", type: "host" },
      declare: { sections: ["os"] },
    });

    expect(machine.target.id).toBe("host");
  });

  it("hands back what it read rather than being it", () => {
    expect(Array.isArray(new Facts())).toBe(false);
    expect(Facts.prototype instanceof Array).toBe(false);
  });
});
