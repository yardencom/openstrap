import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Facts } from "../Facts.js";

describe("Facts public API", () => {
  it("does not expose a public barrel", () => {
    const publicBarrel = readFileSync(join(process.cwd(), "src/Facts/index.ts"), "utf8");

    expect(publicBarrel).toBe("export {};\n");
    expect(publicBarrel).not.toContain("CollectFactsFromDefinition");
    expect(publicBarrel).not.toContain("FactsDefinitionJsonSchema");
    expect(publicBarrel).not.toContain("HostFacts");
    expect(publicBarrel).not.toContain("SystemSnapshot");
    expect(publicBarrel).not.toContain("ProcessServiceInventory");
    expect(publicBarrel).not.toContain("FactImportance");
    expect(publicBarrel).not.toContain("CommandFact");
  });

  it("keeps Facts instance free of collection methods", () => {
    const publicMethods = Object.getOwnPropertyNames(Facts.prototype).filter((name) => name !== "constructor");

    expect(publicMethods).toEqual([]);
  });

  it("keeps array methods available", () => {
    const facts = new Facts([minimalItem()]);

    expect(Array.isArray(facts)).toBe(true);
    expect(facts.map((item) => item.snapshot.id)).toEqual(["snap_host"]);
    expect(facts.forEach).toBe(Array.prototype.forEach);
  });

  it("exports only Facts from Facts/Facts", () => {
    const source = readFileSync(join(process.cwd(), "src/Facts/Facts.ts"), "utf8");
    const exportedNames = [...source.matchAll(/^export\s+(?:class|type|function|const|let|var|interface|enum)\s+([A-Za-z0-9_]+)/gm)]
      .map((match) => match[1]);

    expect(source).not.toMatch(/^export\s+\{/m);
    expect(source).not.toMatch(/^export\s+type\s+\{/m);
    expect(source).not.toContain("Symbol.species");
    expect(exportedNames).toEqual(["Facts"]);
  });
});

function minimalItem() {
  return {
    snapshot: {
      id: "snap_host",
      schemaVersion: "facts.v1",
      scope: "host",
      target: {
        type: "machine",
        id: "host",
      },
      data: {},
    },
    run: {
      id: "fact_run_host",
      snapshotId: "snap_host",
      startedAt: "2026-06-08T10:00:00.000Z",
      finishedAt: "2026-06-08T10:00:00.000Z",
      status: "success" as const,
    },
  };
}
