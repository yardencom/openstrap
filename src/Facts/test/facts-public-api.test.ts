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

  it("represents facts as an array", () => {
    const facts = new Facts([minimalItem()]);

    expect(Array.isArray(facts)).toBe(true);
    expect(facts).toHaveLength(1);
    expect(facts[0]!.snapshot.id).toBe("snap_host");
  });

  it("collects through an API that can wait, not through the constructor", async () => {
    let resolveCollection: (items: readonly unknown[]) => void = () => {};
    const pending = new Promise<readonly unknown[]>((resolve) => {
      resolveCollection = resolve;
    });
    let started = false;

    const facts = Facts.collect({
      blueprint: blueprintAskingForOs(),
      runtime: {
        factsBackend: {
          collect: () => {
            started = true;
            return pending as Promise<never>;
          },
        },
      },
    });

    expect(started).toBe(true);
    resolveCollection([minimalItem()]);

    expect([...(await facts)]).toHaveLength(1);
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

function blueprintAskingForOs() {
  return {
    target: {
      name: "host",
      scope: "host",
      type: "host",
      transport: "local",
      requirements: [{ id: "os-known", os: { family: { status: "present" } } }],
    },
  };
}

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
