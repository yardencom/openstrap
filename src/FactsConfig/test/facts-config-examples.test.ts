import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseYaml } from "./facts-config-test-harness.js";

describe("FactsConfig examples", () => {
  it("validates committed facts definition examples", () => {
    const minimal = readFileSync(join(process.cwd(), "examples/facts/minimal.yaml"), "utf8");
    const crossPlatform = readFileSync(join(process.cwd(), "examples/facts/cross-platform.yaml"), "utf8");

    expect(parseYaml(minimal).id).toBe("unix-baseline");
    expect(parseYaml(crossPlatform).commands.some((command: { id: string }) => command.id === "git")).toBe(true);
  });
});
