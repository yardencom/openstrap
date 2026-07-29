import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Transport boundaries", () => {
  it("keeps Transport unaware that openstrap exists", () => {
    const offenders = transportSourceFiles().filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      return /from\s+["'][^"']*(Blueprint|Facts|Plugin|Requirements|ConfigCore)/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps the transport ports free of any implementation dependency", () => {
    const domainPath = join(process.cwd(), "src/Transport/Domain");
    const offenders = listSourceFiles(domainPath).filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)];

      return imports.some((match) => !match[1]!.startsWith("./"));
    });

    expect(offenders).toEqual([]);
  });

  it("keeps progress output and the openstrap process environment out of the port", () => {
    const transport = readFileSync(join(process.cwd(), "src/Transport/domain/Transport.ts"), "utf8");
    const barrel = readFileSync(join(process.cwd(), "src/Transport/index.ts"), "utf8");

    for (const absent of ["OutputAPI", "EnvironmentAPI", "stateHome", "prependPathDirectory", "progress"]) {
      expect(transport).not.toContain(absent);
      expect(barrel).not.toContain(absent);
    }
  });

  it("does not import transport adapters outside the Transport module", () => {
    const outsideTransport = listSourceFiles(join(process.cwd(), "src")).filter(
      (filePath: string) => !filePath.includes("/src/Transport/"),
    );
    const offenders = outsideTransport.filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      return /Transport\/Adapters/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps Transport as the only import path from other modules", () => {
    const outsideTransport = listSourceFiles(join(process.cwd(), "src")).filter(
      (filePath: string) => !filePath.includes("/src/Transport/"),
    );
    const offenders = outsideTransport.filter((filePath: string) => {
      const source = readFileSync(filePath, "utf8");
      const imports = [...source.matchAll(/from\s+["']([^"']*Transport\/[^"']+)["']/g)];

      return imports.some((match) => !match[1]!.endsWith("/Transport/index.js"));
    });

    expect(offenders).toEqual([]);
  });
});

function transportSourceFiles(): string[] {
  return listSourceFiles(join(process.cwd(), "src/Transport")).filter(
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
