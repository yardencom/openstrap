import { describe, expect, it } from "vitest";

import { parseYaml } from "./facts-test-harness.js";

describe("Facts parsing", () => {
  it("parses a minimal reusable facts definition", () => {
    const definition = parseYaml(`
id: unix-baseline
version: 1
description: Baseline facts for Unix-like execution contexts

commands:
  - id: shell
    name: bash
    platforms: [linux, macos]

env:
  - id: path
    names: [PATH]
    redaction: none
`);

    expect(definition.id).toBe("unix-baseline");
    expect(definition.commands?.[0]?.importance).toBe("required");
    expect(definition.env?.[0]?.redaction).toBe("none");
  });

  it("supports minimal inputs for declaration templates", () => {
    const definition = parseYaml(`
id: workspace-baseline
version: 1
description: Workspace facts that can be bound by a workflow later

inputs:
  workspace: {}
  target:
    required: true
    default:
      services:
        name: docker
        path: {}

files:
  - id: workspace
    path: "{{ inputs.workspace }}"
    require: [exists, writable]
    importance: optional
`);

    expect(definition.inputs?.workspace).toEqual({});
    expect(definition.inputs?.target?.required).toBe(true);
    expect(definition.inputs?.target?.default).toEqual({
      services: {
        name: "docker",
        path: {},
      },
    });
    expect(definition.files?.[0]?.path).toBe("{{ inputs.workspace }}");
  });

  it("keeps collection defaults out of files and accepts per-declaration overrides", () => {
    const definition = parseYaml(`
id: limits-example
version: 1
description: Collection limits are owned by the runtime and overridden per fact
commands:
  - id: git
    name: git
    timeoutMs: 3000
`);

    expect(definition.commands![0]!.timeoutMs).toBe(3000);
    expect(definition.commands![0]!.maxOutputBytes).toBeUndefined();
  });

  it("uses explicit user and group identities", () => {
    const definition = parseYaml(`
id: principal-identities-example
version: 1
description: Principal declarations name concrete identities
users:
  - id: root-user
    name: root
  - id: uid-zero
    uid: 0
groups:
  - id: admin-group
    name: admin
  - id: gid-zero
    gid: 0
`);

    expect(definition.users?.[0]).toMatchObject({ name: "root" });
    expect(definition.users?.[1]).toMatchObject({ uid: 0 });
    expect(definition.groups?.[0]).toMatchObject({ name: "admin" });
    expect(definition.groups?.[1]).toMatchObject({ gid: 0 });
  });

  it("uses session kind and artifact capture without principal selectors", () => {
    const definition = parseYaml(`
id: session-artifact-example
version: 1
description: Sessions and artifacts describe observable runtime evidence
sessions:
  - id: interactive-sessions
    kind: interactive
artifacts:
  - id: workspace-log
    path: "{{ inputs.workspace }}/openstrap.log"
    kind: log
    capture: hash
`);

    expect(definition.sessions?.[0]?.kind).toBe("interactive");
    expect(definition.artifacts?.[0]?.capture).toBe("hash");
  });

  it("can request multiple package records independently from executable commands", () => {
    const definition = parseYaml(`
id: package-example
version: 1
description: Packages describe installed software records, commands describe executables
commands:
  - id: npm-command
    name: npm
    importance: optional
packages:
  - id: package-managers
    names: [npm, uv, chocolatey]
    manager: auto
    importance: optional
`);

    expect(definition.commands?.[0]?.name).toBe("npm");
    expect(definition.packages?.[0]?.names).toEqual(["npm", "uv", "chocolatey"]);
  });

  it("defaults declaration importance to required", () => {
    const definition = parseYaml(`
id: default-importance
version: 1
description: Missing declaration importance becomes required
commands:
  - id: git
    name: git
`);

    expect(definition.commands?.[0]?.importance).toBe("required");
  });
});
