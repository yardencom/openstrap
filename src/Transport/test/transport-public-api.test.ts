import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const expectedExports = [
  "CapturedSystemCommand",
  "DetachedProcessCommand",
  "DownloadResult",
  "FileAccess",
  "FileSystemAPI",
  "FileSystemWriteOptions",
  "NetworkAPI",
  "NetworkRequest",
  "NetworkResponse",
  "ProcessAPI",
  "ProcessOutput",
  "RemovePathOptions",
  "SystemCommand",
  "TextFileWriteOptions",
  "Transport",
];

describe("Transport public API", () => {
  it("exports the three ports and nothing beyond their vocabulary", () => {
    expect(barrelExports()).toEqual(expectedExports);
  });

  it("exposes types only, so the port cannot carry behaviour", () => {
    const barrel = readFileSync(barrelPath(), "utf8");
    const valueExports = [...barrel.matchAll(/^export\s+(?!type\b)/gm)];

    expect(valueExports).toEqual([]);
  });

  it("describes a transport as filesystem, network and process access", () => {
    const source = readFileSync(join(process.cwd(), "src/Transport/Domain/Transport.ts"), "utf8");
    const members = [...source.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]);

    expect(members).toEqual(["fileSystem", "network", "processes"]);
  });
});

function barrelExports(): string[] {
  const barrel = readFileSync(barrelPath(), "utf8");

  return [...barrel.matchAll(/export\s+type\s+\{([^}]+)\}/g)]
    .flatMap((match) => match[1]!.split(","))
    .map((name) => name.trim())
    .filter(Boolean)
    .sort();
}

function barrelPath(): string {
  return join(process.cwd(), "src/Transport/index.ts");
}
