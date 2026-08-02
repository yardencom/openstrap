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

  it("takes the key of a named section as the machine spells it", () => {
    // These are somebody else's names: a variable is written in capitals, a path is a path, a file
    // is a file name. They were checked as identifiers of this file format — lowercase, no slashes —
    // so a requirement about `HOME` or `/etc/ssh/sshd_config` was refused before anything ran.
    const blueprint = loadBlueprint(`
targets:
  local:
    requirements:
      - id: real-names
        env:
          HOME:
            status: present
        paths:
          /etc/ssh/sshd_config:
            exists: true
        artifacts:
          package.json:
            status: present
`);

    const requirement = blueprint.targets.local!.requirements[0] as Record<string, Record<string, unknown>>;

    expect(Object.keys(requirement.env!)).toEqual(["HOME"]);
    expect(Object.keys(requirement.paths!)).toEqual(["/etc/ssh/sshd_config"]);
    expect(Object.keys(requirement.artifacts!)).toEqual(["package.json"]);
  });

  it("refuses one thing described by two requirements", () => {
    // A machine is read once, so a name written twice is one entry in the order and two claims on
    // it — and a verdict where the same file passes on one line and fails on another. Caught reading
    // the blueprint, because nothing about any machine makes it better or worse.
    expect(() => loadBlueprint(`
targets:
  local:
    requirements:
      - id: where
        paths:
          config:
            path: /etc/ssh/sshd_config
      - id: readable
        paths:
          config:
            readable: true
`)).toThrow(/described by "where" and by "readable"/);
  });

  it("lets two requirements be about different things in one section", () => {
    const blueprint = loadBlueprint(`
targets:
  local:
    requirements:
      - id: ssh
        services:
          ssh:
            running: true
      - id: cron
        services:
          cron:
            running: true
`);

    expect(blueprint.targets.local!.requirements).toHaveLength(2);
  });

  it("refuses a name that could not be one", () => {
    // A name with a space at the end matches nothing on the machine and would be reported as an
    // absence, which reads as "the variable is missing" rather than "the blueprint has a typo".
    expect(() => loadBlueprint(`
targets:
  local:
    requirements:
      - id: trailing-space
        env:
          "HOME ":
            status: present
`)).toThrow(/Invalid key in record/);
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
