import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FactsConfig } from "../index.js";

describe("FactsConfig public API", () => {
  it("exposes a narrow class-only public barrel", () => {
    const publicBarrel = readFileSync(join(process.cwd(), "src/FactsConfig/index.ts"), "utf8");
    const publicMethods = Object.getOwnPropertyNames(FactsConfig.prototype).filter((name) => name !== "constructor");

    expect(publicBarrel.trim()).toBe('export { FactsConfig } from "./FactsConfig.js";');
    expect(publicMethods).toEqual(["parseYaml", "getJsonSchema"]);
  });
});
