import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  Blueprints,
} from "../index.js";
import { BlueprintReadError } from "../errors/BlueprintReadError.js";

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
  });

  it("carries several targets, each with the requirements written inside it", () => {
    const blueprint = loadBlueprint(`
targets:
  builder:
    displayName: Local machine
    requirements:
      - id: node-runtime
        runtimes:
          node:
            ready: true
  ubuntu-vm:
    provider: utm
    image: ubuntu:24.04
    size: medium
    requirements:
      - id: ssh-ready
        transports:
          ssh:
            status: present
            ready: true
`);

    expect(Object.keys(blueprint.targets)).toEqual(["builder", "ubuntu-vm"]);
    expect(blueprint.targets.builder!.requirements.map((requirement) => requirement.id)).toEqual(["node-runtime"]);
    expect(blueprint.targets["ubuntu-vm"]!.requirements.map((requirement) => requirement.id)).toEqual(["ssh-ready"]);
  });

  it("accepts a target with nothing required of it", () => {
    const blueprint = loadBlueprint(`
targets:
  app: {}
`);

    expect(blueprint.targets.app!.requirements).toEqual([]);
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
        runtimes:
          node:
            ready: true
`),
    ).toThrow(BlueprintReadError);
  });

  /**
   * A requirement cannot name a target, because it is already inside one.
   *
   * This used to be a flat list where every requirement repeated the name of the
   * target it was about, which made "a requirement pointing at a target nobody
   * declared" a state the format allowed and the loader had to catch. Inside a
   * target the name is redundant and the dangling reference is unwritable.
   */
  it("rejects a requirement that names a target", () => {
    expect(() =>
      loadBlueprint(`
targets:
  app:
    requirements:
      - id: node-runtime
        target: app
        runtimes:
          node:
            ready: true
`),
    ).toThrow(BlueprintReadError);
  });

  it("rejects requirements written outside a target", () => {
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

  it("rejects duplicate requirement ids within a target", () => {
    expect(() =>
      loadBlueprint(`
targets:
  app:
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

  it("rejects backend and engine fields on requirements", () => {
    for (const field of ["backend: goss", "engine: cel"]) {
      expect(() =>
        loadBlueprint(`
targets:
  app:
    requirements:
      - id: node-runtime
        ${field}
        runtimes:
          node:
            ready: true
`),
      ).toThrow(BlueprintReadError);
    }
  });

  it("rejects requirement blocks that do not match facts sections", () => {
    expect(() =>
      loadBlueprint(`
targets:
  app:
    requirements:
      - id: node-runtime
        runtime:
          node:
            ready: true
`),
    ).toThrow(BlueprintReadError);
  });

  it("requires a requirement to say something about the machine", () => {
    expect(() =>
      loadBlueprint(`
targets:
  app:
    requirements:
      - id: says-nothing
`),
    ).toThrow(BlueprintReadError);
  });
});
