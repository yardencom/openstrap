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

  /**
   * openstrap writes its own files where a program keeps its files, never into the project.
   *
   * The project holds what a person wrote — the blueprint, the facts definition — and openstrap only
   * reads it. What openstrap works out is its own, and it goes under `StateHome`, which honours
   * `XDG_STATE_HOME`. There used to be one exception, `openstrap.lock.yaml`, and it was a file the
   * program wrote and never read (ADR 0003).
   */
  it("writes nothing into the project it was pointed at", () => {
    const writes = /writeFile|writeFileSync|writeTextFile|mkdirSync|createDirectory|appendFile|openSync/;
    const offenders = listSourceFiles(join(process.cwd(), "src"))
      .filter((filePath: string) => !filePath.includes("/test/") && !filePath.includes(".test."))
      .filter((filePath: string) => {
        const source = readFileSync(filePath, "utf8");

        return source.includes("workspaceRoot") && writes.test(source);
      });

    expect(offenders.map((filePath: string) => filePath.slice(process.cwd().length + 1))).toEqual([]);
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
