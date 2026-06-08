import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BlueprintDocumentReadError,
  BlueprintValidationError,
  BlueprintValidator,
  Blueprints,
} from "../index.js";

const blueprints = new Blueprints();

describe("Blueprint", () => {
  it("parses the runnable local sample into canonical host target and requirements", () => {
    const blueprint = blueprints.parseYaml(
      readFileSync(join(process.cwd(), "examples/openstrap/local-run.yaml"), "utf8"),
    );

    expect(blueprint.targets).toEqual([
      {
        name: "host",
        scope: "host",
        type: "machine",
        displayName: "Local host",
        transport: "local",
      },
    ]);
    expect(blueprint.requirements.map((requirement) => requirement.id)).toContain("node-runtime");
    expect(blueprint.requirements.every((requirement) => requirement.target === "host")).toBe(true);
  });

  it("transforms host requirements without repeating target", () => {
    const blueprint = blueprints.parseYaml(`
host:
  requirements:
    - id: node-runtime
      runtimes:
        node:
          ready: true
`);

    expect(blueprint.targets.map((target) => target.name)).toEqual(["host"]);
    expect(blueprint.requirements[0]).toMatchObject({
      id: "node-runtime",
      target: "host",
    });
  });

  it("rejects explicit top-level requirements without target at document boundary", () => {
    expect(() =>
      blueprints.parseYaml(`
targets:
  - name: host
    scope: host
    type: machine
    transport: local
requirements:
  - id: node-runtime
    runtimes:
      node:
        ready: true
`),
    ).toThrow(BlueprintDocumentReadError);
  });

  it("rejects requirements that reference unknown targets", () => {
    expect(() =>
      blueprints.parseYaml(`
targets:
  - name: host
    scope: host
    type: machine
    transport: local
requirements:
  - id: node-runtime
    target: guest
    runtimes:
      node:
        ready: true
`),
    ).toThrow(/Unknown target "guest"/);
  });

  it("rejects duplicate requirement ids", () => {
    expect(() =>
      blueprints.parseYaml(`
host:
  requirements:
    - id: node-runtime
      runtimes:
        node:
          ready: true
    - id: node-runtime
      transports:
        local:
          ready: true
`),
    ).toThrow(BlueprintDocumentReadError);
  });

  it("rejects multi-target requirements", () => {
    expect(() =>
      blueprints.parseYaml(`
targets:
  - name: host
    scope: host
    type: machine
    transport: local
requirements:
  - id: node-runtime
    target: [host, guest]
    runtimes:
      node:
        ready: true
`),
    ).toThrow(BlueprintDocumentReadError);
  });

  it("rejects backend and engine fields on requirements", () => {
    expect(() =>
      blueprints.parseYaml(`
host:
  requirements:
    - id: node-runtime
      backend: goss
      runtimes:
        node:
          ready: true
`),
    ).toThrow(BlueprintDocumentReadError);

    expect(() =>
      blueprints.parseYaml(`
host:
  requirements:
    - id: node-runtime
      engine: cel
      runtimes:
        node:
          ready: true
`),
    ).toThrow(BlueprintDocumentReadError);
  });

  it("rejects requirement blocks that do not match facts sections", () => {
    expect(() =>
      blueprints.parseYaml(`
host:
  requirements:
    - id: node-runtime
      runtime:
        node:
          ready: true
`),
    ).toThrow(BlueprintDocumentReadError);
  });

  it("validator rejects canonical blueprints with duplicated target names", () => {
    const validator = new BlueprintValidator();

    expect(() =>
      validator.assertValid({
        targets: [
          { name: "host", scope: "host", type: "machine", transport: "local" },
          { name: "host", scope: "host", type: "machine", transport: "local" },
        ],
        requirements: [
          {
            id: "node-runtime",
            target: "host",
            runtimes: {
              node: {
                ready: true,
              },
            },
          },
        ],
      }),
    ).toThrow(BlueprintValidationError);
  });
});
