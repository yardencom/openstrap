import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { JsonFileExporter } from "../index.js";

describe("JsonFileExporter", () => {
  it("writes JSON to the requested file path", () => {
    const directory = mkdtempSync(join(tmpdir(), "openstrap-json-export-"));

    try {
      const resultPath = join(directory, "nested", "result.json");
      const payload = {
        status: "success",
        facts: [{ id: "snapshot" }],
      };
      const result = new JsonFileExporter().write({
        resultPath,
        payload,
      });

      expect(result.resultPath).toBe(resultPath);
      expect(existsSync(resultPath)).toBe(true);
      expect(JSON.parse(readFileSync(resultPath, "utf8"))).toEqual(payload);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
