import { describe, expect, it } from "vitest";

import { parseYaml } from "./facts-test-harness.js";

describe("Facts validation", () => {
  it("rejects top-level collection defaults in facts definition files", () => {
    expect(() =>
      parseYaml(`
id: invalid-defaults
version: 1
description: Runtime defaults do not belong in reusable facts definition files
defaults:
  timeoutMs: 5000
commands:
  - id: git
    name: git
`),
    ).toThrow(/Invalid facts definition/);
  });

  it("rejects dynamic principal selectors", () => {
    expect(() =>
      parseYaml(`
id: invalid-dynamic-principal
version: 1
description: Runtime identities belong to provenance, not reusable facts definitions
users:
  - id: current-user
    collect: current
`),
    ).toThrow(/Invalid facts definition/);
  });

  it("rejects workflow, target, transport, storage, and export concerns", () => {
    expect(() =>
      parseYaml(`
id: invalid-definition
version: 1
description: This file tries to select execution machinery
target:
  id: local
provider:
  name: virtualbox
workflow:
  trigger: preflight
transport:
  type: ssh
storage:
  type: sqlite
retention:
  days: 7
scheduler:
  cron: "* * * * *"
export:
  endpoint: https://example.invalid/facts
commands:
  - id: git
    name: git
    importance: optional
`),
    ).toThrow(/Invalid facts definition/);
  });

  it("rejects unknown importance values", () => {
    expect(() =>
      parseYaml(`
id: invalid-importance-value
version: 1
description: Unknown declaration importance
commands:
  - id: git
    name: git
    importance: blocker
`),
    ).toThrow(/Invalid facts definition/);
  });

  it("rejects duplicate fact ids within the same section", () => {
    expect(() =>
      parseYaml(`
id: duplicate-command
version: 1
description: Duplicate command ids are ambiguous
commands:
  - id: git
    name: git
    importance: required
  - id: git
    name: /usr/bin/git
    importance: optional
`),
    ).toThrow(/Invalid facts definition/);
  });

  it("rejects typed input declarations", () => {
    expect(() =>
      parseYaml(`
id: invalid-typed-input
version: 1
description: Inputs are dynamic values and do not declare their own type
inputs:
  workspace:
    type: path
commands:
  - id: git
    name: git
`),
    ).toThrow(/Invalid facts definition/);
  });

});
