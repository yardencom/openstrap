import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("ConfigCore boundaries", () => {
  it("keeps ConfigCore orchestration independent from concrete backend packages", () => {
    const sourcePaths = [
      join(process.cwd(), "src/ConfigCore/Application/ConfigCore.ts"),
      ...readdirSync(join(process.cwd(), "src/ConfigCore/Ports")).map((entry) =>
        join(process.cwd(), "src/ConfigCore/Ports", entry),
      ),
    ];

    const offenders = sourcePaths.filter((filePath) => {
      const source = readFileSync(filePath, "utf8");

      return /\bZod\b|\bzod\b|\bLilconfig\b|\blilconfig\b|from "\.\.\/Adapters/.test(source);
    });

    expect(offenders).toEqual([]);
  });
});
