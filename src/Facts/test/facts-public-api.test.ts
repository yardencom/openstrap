import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Facts } from "../index.js";

describe("Facts public API", () => {
  it("exposes the Facts module without config/runtime module aliases", () => {
    const publicBarrel = readFileSync(join(process.cwd(), "src/Facts/index.ts"), "utf8");
    const publicMethods = Object.getOwnPropertyNames(Facts.prototype).filter((name) => name !== "constructor");

    expect(publicBarrel).toContain('export { Facts } from "./Facts.js";');
    expect(publicMethods).toEqual(["parseDefinitionYaml", "getDefinitionJsonSchema"]);
  });
});
