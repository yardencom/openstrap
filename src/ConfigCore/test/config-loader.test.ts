import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ConfigNotFoundError, type ConfigLoadRequest } from "../index.js";
import { exampleConfigCore, exampleDefinition } from "./config-core-test-fixtures.js";

describe("ConfigCore loading", () => {
  it("exposes one public loading method", () => {
    expect(typeof exampleConfigCore.load).toBe("function");
    expect("loadYaml" in exampleConfigCore).toBe(false);
    expect("loadDocument" in exampleConfigCore).toBe(false);
    expect("tryLoad" in exampleConfigCore).toBe(false);
    expect("tryLoadDocument" in exampleConfigCore).toBe(false);
  });

  it("loads inline YAML through the configured backend and schema backend", () => {
    const config = exampleConfigCore.load(exampleDefinition, {
      content: `
id: sample
`,
    });

    expect(config).toEqual({ id: "sample", mode: "strict" });
  });

  it("discovers workspace config files through ordered file patterns", () => {
    const directory = mkdtempSync(join(tmpdir(), "openstrap-config-core-"));

    try {
      mkdirSync(join(directory, ".openstrap"));
      writeFileSync(
        join(directory, ".openstrap", "example.yaml"),
        `
id: nested
`,
      );
      writeFileSync(
        join(directory, "openstrap.example.yaml"),
        `
id: root
mode: loose
`,
      );

      const config = exampleConfigCore.load(exampleDefinition, {
        searchRoot: directory,
      });

      expect(config).toEqual({ id: "root", mode: "loose" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("prioritizes explicit config before workspace discovery", () => {
    const directory = mkdtempSync(join(tmpdir(), "openstrap-config-core-"));

    try {
      writeFileSync(
        join(directory, "explicit.yaml"),
        `
id: explicit
`,
      );
      writeFileSync(
        join(directory, "openstrap.example.yaml"),
        `
id: workspace
`,
      );

      const config = exampleConfigCore.load(exampleDefinition, {
        explicitPath: join(directory, "explicit.yaml"),
        workspaceRoot: directory,
      });

      expect(config).toEqual({ id: "explicit", mode: "strict" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does not fall back to workspace discovery when explicit path is missing", () => {
    const directory = mkdtempSync(join(tmpdir(), "openstrap-config-core-"));

    try {
      writeFileSync(
        join(directory, "openstrap.example.yaml"),
        `
id: workspace
`,
      );

      expect(() =>
        exampleConfigCore.load(exampleDefinition, {
          explicitPath: join(directory, "missing.yaml"),
          workspaceRoot: directory,
        }),
      ).toThrow(ConfigNotFoundError);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("throws when config cannot be found", () => {
    const directory = mkdtempSync(join(tmpdir(), "openstrap-config-core-"));

    try {
      const request: ConfigLoadRequest = {
        searchRoot: directory,
      };

      expect(() => exampleConfigCore.load(exampleDefinition, request)).toThrow(ConfigNotFoundError);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
