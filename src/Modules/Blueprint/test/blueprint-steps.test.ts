import { describe, expect, it } from "vitest";

import { Blueprints } from "../index.js";
import { BlueprintReadError } from "../errors/BlueprintReadError.js";

const blueprints = new Blueprints();

/** What a person writes, and the whole of what they write. Two lines for the step. */
const declared = `
targets:
  server:
    requirements:
      - id: kubernetes-running
        network:
          ports:
            tcp/6443:
              state: listening
        steps:
          - id: install-k3s
            run: curl -sfL https://get.k3s.io | sh -
          - id: link-kubectl
            exec: [ln, -sf, /usr/local/bin/k3s, /usr/local/bin/kubectl]
`;

describe("what a blueprint says about making a machine right", () => {
  it("takes a step written inside a requirement to be for that requirement", () => {
    const target = blueprints.load({ content: declared }).targets.server!;

    // Nothing named the requirement and nothing copied a fact path: the connection is where the
    // step sits. A name written twice is a name that can be typed wrong once.
    expect(target.steps!.map((step) => ({ id: step.id, requirements: step.requirements }))).toEqual([
      { id: "install-k3s", requirements: ["kubernetes-running"] },
      { id: "link-kubectl", requirements: ["kubernetes-running"] },
    ]);
  });

  it("turns a shell line into a shell, and a list into a program and its arguments", () => {
    const target = blueprints.load({ content: declared }).targets.server!;

    // A pipe needs a shell. Having the person write `sh -c` is having them write it wrong sometimes.
    expect(target.steps![0]!.action).toEqual({
      kind: "run",
      command: "sh",
      args: ["-c", "curl -sfL https://get.k3s.io | sh -"],
      shell: true,
      cwd: undefined,
      environment: undefined,
      timeoutMs: undefined,
    });
    // A list is run with no shell to reinterpret it, so a filename with a space in it is one word.
    expect(target.steps![1]!.action).toMatchObject({
      kind: "run",
      command: "ln",
      args: ["-sf", "/usr/local/bin/k3s", "/usr/local/bin/kubectl"],
    });
    expect(target.steps![1]!.action).not.toHaveProperty("shell", true);
  });

  it("hands the checker a requirement with no steps in it, because a step is not a fact", () => {
    const [requirement] = blueprints.load({ content: declared }).targets.server!.requirements;

    expect(Object.keys(requirement!)).toEqual(["id", "network"]);
  });

  it("declares what a machine must be without saying how, because checking is a use of its own", () => {
    const target = blueprints.load({
      content: "targets:\n  server:\n    requirements:\n      - id: arch\n        arch: arm64\n",
    }).targets.server!;

    expect(target.steps).toBeUndefined();
  });

  it("carries a step that is for more than one requirement, which names them", () => {
    const target = blueprints.load({ content: twoRequirements("        for: [database-listening, server-answering]\n") }).targets.server!;

    // By name and not by fact path. The names are in the same file ten lines up, so a wrong one is
    // caught when the blueprint is read; a wrong path would validate and never match anything.
    expect(target.steps![0]).toMatchObject({
      id: "bring-the-stack-up",
      requirements: ["database-listening", "server-answering"],
    });
  });

  it("refuses a step written for a requirement nobody declared", () => {
    expect(() => blueprints.load({ content: twoRequirements("        for: [database-listening, the-moon]\n") }))
      .toThrow(/no requirement of this target is called "the-moon"/);
  });

  it("refuses a step beside the requirements that does not say what it is for", () => {
    expect(() => blueprints.load({ content: `
targets:
  server:
    steps:
      - id: whatever
        run: whatever
` })).toThrow(BlueprintReadError);
  });

  it("refuses a step inside a requirement that names what it is for, which is already known", () => {
    expect(() => blueprints.load({ content: `
targets:
  server:
    requirements:
      - id: arch
        arch: arm64
        steps:
          - id: a-step
            for: [arch]
            run: whatever
` })).toThrow(BlueprintReadError);
  });

  it("refuses a way of acting on a machine that no channel offers", () => {
    expect(() => blueprints.load({ content: inRequirement("          - id: a-step\n            install: postgresql\n") }))
      .toThrow(BlueprintReadError);
  });

  it("refuses a step that does two things, because one of them would silently not happen", () => {
    expect(() => blueprints.load({ content: inRequirement(
      "          - id: a-step\n            run: whatever\n            remove: { path: /tmp/one }\n",
    ) })).toThrow(/does one thing/);
  });

  it("refuses a step that does nothing", () => {
    expect(() => blueprints.load({ content: inRequirement("          - id: a-step\n            guard: { arch: arm64 }\n") }))
      .toThrow(/has to do one of/);
  });

  it("refuses a guard that is not a condition over the facts", () => {
    expect(() => blueprints.load({ content: inRequirement(
      "          - id: a-step\n            guard: { whether-i-feel-like-it: true }\n            run: whatever\n",
    ) })).toThrow(BlueprintReadError);
  });

  it("refuses one name used by two steps, wherever the two are written", () => {
    // Each list is checked for repeats on its own, and two lists are not. Steps are gathered by
    // name, so the second of these would quietly replace the first and never run.
    expect(() => blueprints.load({ content: `
targets:
  server:
    requirements:
      - id: first
        arch: arm64
        steps:
          - id: do-the-thing
            run: one
      - id: second
        cpu: { cores: { minimum: 2 } }
        steps:
          - id: do-the-thing
            run: two
` })).toThrow(/one name is one step/);
  });
});

/** One target, one requirement, and whatever is written here as its steps. */
function inRequirement(steps: string): string {
  return `
targets:
  server:
    requirements:
      - id: arch
        arch: arm64
        steps:
${steps}`;
}

/** Two requirements one step could make true at once, and whatever that step says it is for. */
function twoRequirements(forWhat: string): string {
  return `
targets:
  server:
    requirements:
      - id: database-listening
        network: { ports: { tcp/5432: { state: listening } } }
      - id: server-answering
        network: { ports: { tcp/8080: { state: listening } } }
    steps:
      - id: bring-the-stack-up
${forWhat}        run: docker compose up -d
        cwd: /srv/app
`;
}
