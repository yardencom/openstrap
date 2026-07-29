import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("State store boundaries", () => {
  it("keeps the state store unaware that openstrap exists", () => {
    const offenders = storeSourceFiles().filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      return /from\s+["'][^"']*(Blueprint|Facts|Plugin|Requirements|ConfigCore|Transport)/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps SQL inside the sqlite adapter", () => {
    const outsideAdapter = storeSourceFiles().filter(
      (filePath: string) => !filePath.includes("/adapters/sqlite/"),
    );
    const offenders = outsideAdapter.filter((filePath: string) =>
      /CREATE TABLE|INSERT INTO|SELECT .* FROM/.test(readFileSync(filePath, "utf8")),
    );

    expect(offenders).toEqual([]);
  });

  it("does not keep the machine's actual state", () => {
    const schema = readFileSync(join(process.cwd(), "src/StateStore/adapters/sqlite/Schema.ts"), "utf8");

    for (const absent of ["actual_state", "machine_status", "current_state"]) {
      expect(schema).not.toContain(absent);
    }
  });

  it("keeps secret values out of the schema", () => {
    const schema = readFileSync(join(process.cwd(), "src/StateStore/adapters/sqlite/Schema.ts"), "utf8");

    expect(schema).toMatch(/secret_reference/);
    expect(schema).not.toMatch(/private_key|secret_value|password/);
  });

  it("reaches the state store only through its barrel", () => {
    const outsideStore = listSourceFiles(join(process.cwd(), "src")).filter(
      (filePath: string) => !filePath.includes("/src/StateStore/"),
    );
    const offenders = outsideStore.filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      const imports = [...source.matchAll(/from\s+["']([^"']*StateStore\/[^"']+)["']/g)];

      return imports.some((match) => !match[1]!.endsWith("/StateStore/index.js"));
    });

    expect(offenders).toEqual([]);
  });
});

function storeSourceFiles(): string[] {
  return listSourceFiles(join(process.cwd(), "src/StateStore")).filter(
    (filePath: string) => !filePath.includes("/test/"),
  );
}

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
