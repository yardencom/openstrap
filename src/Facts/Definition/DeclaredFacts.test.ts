import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DeclaredFacts } from "./DeclaredFacts.js";
import type { FactsDefinition } from "./Domain/Entities/FactsDefinition.js";
import { FactImportance } from "./Domain/ValueObjects/FactImportance.js";

const workspaceRoot = "/workspace/app";

describe("a facts definition read as an order", () => {
  it("turns a list of entries into things named by their id", () => {
    const declared = new DeclaredFacts({
      workspaceRoot,
      definition: definition({
        processes: [{ id: "node-process", name: "node", importance: FactImportance.Evidence }],
        services: [{ id: "openssh", name: "sshd", manager: "systemd", importance: FactImportance.Required }],
      }),
    });

    expect(declared.declaration.processes).toEqual({
      "node-process": { name: "node", command: undefined, platforms: undefined, redaction: undefined },
    });
    expect(declared.declaration.services).toEqual({
      openssh: { name: "sshd", manager: "systemd", platforms: undefined },
    });
  });

  it("asks only about the sections the definition mentions", () => {
    const declared = new DeclaredFacts({
      workspaceRoot,
      definition: definition({ processes: [{ id: "node-process", importance: FactImportance.Evidence }] }),
    });

    expect(declared.declaration.sections).toEqual(["processes"]);
  });

  it("calls the file section by the name the reading uses for it", () => {
    const declared = new DeclaredFacts({
      workspaceRoot,
      definition: definition({ files: [{ id: "tree", path: ".", importance: FactImportance.Required }] }),
    });

    expect(declared.declaration.sections).toEqual(["paths"]);
    expect(Object.keys(declared.declaration.paths ?? {})).toEqual(["tree"]);
  });

  it("resolves a relative path against the workspace the definition was found in", () => {
    const declared = new DeclaredFacts({
      workspaceRoot,
      definition: definition({ files: [{ id: "tree", path: "src", importance: FactImportance.Required }] }),
    });

    expect(declared.declaration.paths!.tree!.path).toBe(join(workspaceRoot, "src"));
  });

  it("leaves a home-relative path for the machine being read to expand", () => {
    const declared = new DeclaredFacts({
      workspaceRoot,
      definition: definition({
        files: [
          { id: "config", path: "$HOME/.ssh/config", importance: FactImportance.Required },
          { id: "home", path: "~", importance: FactImportance.Required },
          { id: "absolute", path: "/etc/hosts", importance: FactImportance.Required },
        ],
      }),
    });

    expect(declared.declaration.paths!.config!.path).toBe("$HOME/.ssh/config");
    expect(declared.declaration.paths!.home!.path).toBe("~");
    expect(declared.declaration.paths!.absolute!.path).toBe("/etc/hosts");
  });

  it("fills an input from the definition's own default", () => {
    const declared = new DeclaredFacts({
      workspaceRoot,
      definition: definition({
        inputs: { "tree-root": { default: "src" } },
        files: [{ id: "tree", path: "{{ inputs.tree-root }}", importance: FactImportance.Required }],
      }),
    });

    expect(declared.declaration.paths!.tree!.path).toBe(join(workspaceRoot, "src"));
  });

  it("lets a given value win over the definition's default", () => {
    const declared = new DeclaredFacts({
      workspaceRoot,
      overrides: { "tree-root": "lib" },
      definition: definition({
        inputs: { "tree-root": { default: "src" } },
        files: [{ id: "tree", path: "{{ inputs.tree-root }}", importance: FactImportance.Required }],
      }),
    });

    expect(declared.declaration.paths!.tree!.path).toBe(join(workspaceRoot, "lib"));
  });

  it("interpolates inputs into command arguments", () => {
    const declared = new DeclaredFacts({
      workspaceRoot,
      overrides: { branch: "main" },
      definition: definition({
        inputs: { branch: {} },
        commands: [{ id: "log", name: "git", args: ["log", "{{ inputs.branch }}"], importance: FactImportance.Evidence }],
      }),
    });

    expect(declared.declaration.commands!.log!.args).toEqual(["log", "main"]);
  });

  it("expands the shorthand form of redaction into the one shape the reading acts on", () => {
    const declared = new DeclaredFacts({
      workspaceRoot,
      definition: definition({
        commands: [
          { id: "hashed", name: "env", importance: FactImportance.Evidence, redaction: "hash" as never },
          {
            id: "masked",
            name: "env",
            importance: FactImportance.Evidence,
            redaction: { strategy: "mask" as never, patterns: ["token=\\S+"] },
          },
        ],
      }),
    });

    expect(declared.declaration.commands!.hashed!.redaction).toEqual({ strategy: "hash" });
    expect(declared.declaration.commands!.masked!.redaction).toEqual({ strategy: "mask", patterns: ["token=\\S+"] });
  });

  it("carries declared users and groups, with the identity asserted about them", () => {
    const declared = new DeclaredFacts({
      workspaceRoot,
      definition: definition({
        users: [{ id: "root-user", name: "root", uid: 0, importance: FactImportance.Evidence }],
        groups: [{ id: "admin-group", name: "sudo", gid: 27, importance: FactImportance.Optional }],
      }),
    });

    expect(declared.declaration.users).toEqual({
      "root-user": { name: "root", uid: 0, platforms: undefined },
    });
    expect(declared.declaration.groups).toEqual({
      "admin-group": { name: "sudo", gid: 27, platforms: undefined },
    });
    expect(declared.declaration.sections).toEqual(["users", "groups"]);
  });

  it("names the sections it declared that openstrap does not read", () => {
    const declared = new DeclaredFacts({
      workspaceRoot,
      definition: definition({
        sessions: [{ id: "interactive-session", importance: FactImportance.Evidence }],
        users: [{ id: "root-user", name: "root", importance: FactImportance.Evidence }],
      }),
    });

    expect(declared.unread).toEqual(["sessions"]);
  });

  it("names nothing when every declared section is read", () => {
    const declared = new DeclaredFacts({
      workspaceRoot,
      definition: definition({ processes: [{ id: "node-process", importance: FactImportance.Evidence }] }),
    });

    expect(declared.unread).toEqual([]);
  });
});

function definition(sections: Partial<FactsDefinition>): FactsDefinition {
  return {
    id: "test-definition",
    version: 1,
    description: "for the purposes of this test",
    ...sections,
  } as FactsDefinition;
}
