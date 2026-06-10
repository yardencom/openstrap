import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  Blueprints,
} from "../index.js";
import {
  BlueprintReadError,
} from "../Application/BlueprintErrors.js";

const blueprints = new Blueprints();

function loadBlueprint(content: string) {
  return blueprints.load({ content });
}

describe("Blueprint", () => {
  it("parses the runnable local sample into canonical target and requirements", () => {
    const blueprint = loadBlueprint(
      readFileSync(join(process.cwd(), "examples/openstrap/local-run.yaml"), "utf8"),
    );

    expect(blueprint.target).toMatchObject({
      name: "local",
      scope: "system",
      type: "machine",
      displayName: "Local machine",
      transport: "local",
    });
    expect(blueprint.target.requirements.map((requirement) => requirement.id)).toContain("node-runtime");
    expect(blueprint.target.requirements.every((requirement) => "target" in requirement)).toBe(false);
  });

  it("keeps target requirements without repeating target", () => {
    const blueprint = loadBlueprint(`
target:
  name: app
  scope: system
  type: machine
  transport: local
  requirements:
    - id: node-runtime
      runtimes:
        node:
          ready: true
`);

    expect(blueprint.target.name).toBe("app");
    expect(blueprint.target.requirements[0]).toMatchObject({
      id: "node-runtime",
    });
  });

  it("rejects top-level targets form", () => {
    expect(() =>
      loadBlueprint(`
targets:
  - name: app
    scope: system
    type: machine
    transport: local
requirements:
  - id: node-runtime
    runtimes:
      node:
        ready: true
`),
    ).toThrow(BlueprintReadError);
  });

  it("rejects duplicate requirement ids", () => {
    expect(() =>
      loadBlueprint(`
target:
  name: app
  scope: system
  type: machine
  transport: local
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
    ).toThrow(BlueprintReadError);
  });

  it("rejects target field inside target requirements", () => {
    expect(() =>
      loadBlueprint(`
target:
  name: app
  scope: system
  type: machine
  transport: local
  requirements:
    - id: node-runtime
      target: [app, other]
      runtimes:
        node:
          ready: true
`),
    ).toThrow(BlueprintReadError);
  });

  it("rejects backend and engine fields on requirements", () => {
    expect(() =>
      loadBlueprint(`
target:
  name: app
  scope: system
  type: machine
  transport: local
  requirements:
    - id: node-runtime
      backend: goss
      runtimes:
        node:
          ready: true
`),
    ).toThrow(BlueprintReadError);

    expect(() =>
      loadBlueprint(`
target:
  name: app
  scope: system
  type: machine
  transport: local
  requirements:
    - id: node-runtime
      engine: cel
      runtimes:
        node:
          ready: true
`),
    ).toThrow(BlueprintReadError);
  });

  it("rejects requirement blocks that do not match facts sections", () => {
    expect(() =>
      loadBlueprint(`
target:
  name: app
  scope: system
  type: machine
  transport: local
  requirements:
    - id: node-runtime
      runtime:
        node:
          ready: true
`),
    ).toThrow(BlueprintReadError);
  });

});
