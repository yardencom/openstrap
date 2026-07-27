import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  Blueprints,
} from "../index.js";
import {
  BlueprintReadError,
  BlueprintTargetError,
} from "../Application/BlueprintErrors.js";

const blueprints = new Blueprints();

function loadBlueprint(content: string) {
  return blueprints.load({ content });
}

describe("Blueprint", () => {
  it("parses the runnable local sample into canonical targets and requirements", () => {
    const blueprint = loadBlueprint(
      readFileSync(join(process.cwd(), "examples/openstrap/local-run.yaml"), "utf8"),
    );

    expect(blueprint.targets.local).toMatchObject({
      name: "local",
      scope: "host",
      type: "host",
      displayName: "Local machine",
      transport: "local",
    });
    expect(blueprint.targets.local!.requirements.map((requirement) => requirement.id)).toContain("node-runtime");
    expect(blueprint.targets.local!.requirements.every((requirement) => "target" in requirement)).toBe(false);
  });

  it("carries several targets and gives each one its own requirements", () => {
    const blueprint = loadBlueprint(`
targets:
  builder:
    displayName: Local machine
  ubuntu-vm:
    provider: utm
    image: ubuntu:24.04
    size: medium

requirements:
  - id: node-runtime
    target: builder
    runtimes:
      node:
        ready: true
  - id: ssh-ready
    target: ubuntu-vm
    transports:
      ssh:
        status: present
        ready: true
`);

    expect(Object.keys(blueprint.targets)).toEqual(["builder", "ubuntu-vm"]);
    expect(blueprint.targets.builder!.requirements.map((requirement) => requirement.id)).toEqual(["node-runtime"]);
    expect(blueprint.targets["ubuntu-vm"]!.requirements.map((requirement) => requirement.id)).toEqual(["ssh-ready"]);
  });

  it("derives scope, type and transport instead of asking for them", () => {
    const blueprint = loadBlueprint(`
targets:
  ubuntu-vm:
    provider: utm
    image: ubuntu:24.04
    size: medium

requirements:
  - id: ssh-ready
    target: ubuntu-vm
    transports:
      ssh:
        ready: true
`);

    expect(blueprint.targets["ubuntu-vm"]).toMatchObject({
      scope: "guest",
      type: "vm",
      transport: "ssh",
      provider: "utm",
      image: "ubuntu:24.04",
      size: "medium",
    });
  });

  it("rejects scope and type written by hand", () => {
    expect(() =>
      loadBlueprint(`
targets:
  app:
    scope: guest
    type: vm

requirements:
  - id: node-runtime
    target: app
    runtimes:
      node:
        ready: true
`),
    ).toThrow(BlueprintReadError);
  });

  it("rejects the single target form", () => {
    expect(() =>
      loadBlueprint(`
target:
  name: app
  scope: host
  type: host
  transport: local
  requirements:
    - id: node-runtime
      runtimes:
        node:
          ready: true
`),
    ).toThrow(BlueprintReadError);
  });

  it("rejects a requirement that names a target the blueprint does not declare", () => {
    expect(() =>
      loadBlueprint(`
targets:
  app: {}

requirements:
  - id: node-runtime
    target: other
    runtimes:
      node:
        ready: true
`),
    ).toThrow(BlueprintTargetError);
  });

  it("names the declared targets when a requirement points at nothing", () => {
    expect(() =>
      loadBlueprint(`
targets:
  app: {}

requirements:
  - id: node-runtime
    target: other
    runtimes:
      node:
        ready: true
`),
    ).toThrow(/Declared targets: app/);
  });

  it("requires every requirement to name its target", () => {
    expect(() =>
      loadBlueprint(`
targets:
  app: {}

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
targets:
  app: {}

requirements:
  - id: node-runtime
    target: app
    runtimes:
      node:
        ready: true
  - id: node-runtime
    target: app
    transports:
      local:
        ready: true
`),
    ).toThrow(BlueprintReadError);
  });

  it("rejects backend and engine fields on requirements", () => {
    expect(() =>
      loadBlueprint(`
targets:
  app: {}

requirements:
  - id: node-runtime
    target: app
    backend: goss
    runtimes:
      node:
        ready: true
`),
    ).toThrow(BlueprintReadError);

    expect(() =>
      loadBlueprint(`
targets:
  app: {}

requirements:
  - id: node-runtime
    target: app
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
targets:
  app: {}

requirements:
  - id: node-runtime
    target: app
    runtime:
      node:
        ready: true
`),
    ).toThrow(BlueprintReadError);
  });
});
