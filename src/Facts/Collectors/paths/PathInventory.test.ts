import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type {
  CapturedSystemCommand,
  DetachedProcessCommand,
  ProcessAPI,
  ProcessOutput,
  SystemCommand,
} from "../../../Transport/index.js";
import { LocalTransport } from "../../../Transport/index.js";
import { OperatingSystem } from "../OperatingSystem.js";
import { Shell } from "../Shell.js";
import { PathInventory } from "./PathInventory.js";

/**
 * The same real processes, started with a different environment.
 *
 * Nothing is faked — every command still runs on this machine — but the target
 * it reaches has a home directory of its own, which is the situation any remote
 * transport is permanently in, and the only way to tell a path expanded by the
 * target's shell from one expanded in JavaScript against the host.
 */
class TargetProcesses implements ProcessAPI {
  constructor(
    private readonly target: ProcessAPI,
    private readonly variables: Record<string, string>,
  ) {}

  capture(command: CapturedSystemCommand): Promise<ProcessOutput> {
    return this.target.capture({ ...command, environment: { ...command.environment, ...this.variables } });
  }

  processRunning(pid: number): Promise<boolean> {
    return this.target.processRunning(pid);
  }

  run(command: SystemCommand): Promise<void> {
    return this.target.run({ ...command, environment: { ...command.environment, ...this.variables } });
  }

  startDetachedProcess(command: DetachedProcessCommand): Promise<number> {
    return this.target.startDetachedProcess({ ...command, environment: { ...command.environment, ...this.variables } });
  }

  stopDetachedProcess(pid: number, timeoutMs: number): Promise<void> {
    return this.target.stopDetachedProcess(pid, timeoutMs);
  }

  succeeds(command: SystemCommand): Promise<boolean> {
    return this.target.succeeds({ ...command, environment: { ...command.environment, ...this.variables } });
  }
}

describe("PathInventory", () => {
  const shell = new Shell(new LocalTransport().processes);
  /** Named to prove the quoting: a space and an apostrophe in one path. */
  const workspace = "/tmp/openstrap path inventory's";
  let operatingSystem: OperatingSystem;

  beforeAll(async () => {
    operatingSystem = await OperatingSystem.detect(shell);
    await shell.run(
      [
        `rm -rf "${workspace}"`,
        `mkdir -p "${workspace}"`,
        `printf 'reading' > "${workspace}/file.txt"`,
        `ln -s "${workspace}/nothing-here" "${workspace}/dangling"`,
      ].join(" && "),
    );
  });

  afterAll(async () => {
    await shell.run(`rm -rf "${workspace}"`);
  });

  it("answers under the paths section", () => {
    expect(new PathInventory({}).section).toBe("paths");
  });

  it("reports an existing directory as present, readable and searchable", async () => {
    const paths = await new PathInventory({ temporary: "/tmp" }).collect(shell, operatingSystem);

    expect(paths.temporary).toMatchObject({
      status: "present",
      path: "/tmp",
      exists: true,
      type: "directory",
      readable: true,
      executable: true,
    });
  });

  it("keys each fact by the name it was asked for, not by the path", async () => {
    const paths = await new PathInventory({ temporary: "/tmp", root: "/" }).collect(shell);

    expect(Object.keys(paths).sort()).toEqual(["root", "temporary"]);
    expect(paths["/tmp"]).toBeUndefined();
    expect(paths.temporary!.path).toBe("/tmp");
    expect(paths.root!.path).toBe("/");
  });

  it("reports a path that is not there as absent instead of failing", async () => {
    const missing = `${workspace}/nothing-here`;

    const paths = await new PathInventory({ missing }).collect(shell);

    expect(paths.missing).toEqual({
      status: "absent",
      path: missing,
      exists: false,
      readable: false,
      writable: false,
      executable: false,
    });
  });

  it("tells a file apart from the directory holding it", async () => {
    const paths = await new PathInventory({
      directory: workspace,
      file: `${workspace}/file.txt`,
    }).collect(shell);

    expect(paths.directory).toMatchObject({ status: "present", exists: true, type: "directory" });
    expect(paths.file).toMatchObject({ status: "present", exists: true, type: "file", readable: true });
  });

  it("inspects a path containing a space and a quote as one path", async () => {
    const paths = await new PathInventory({ quoted: workspace, inside: `${workspace}/file.txt` }).collect(shell);

    expect(paths.quoted!.path).toBe(workspace);
    expect(paths.quoted!.exists).toBe(true);
    expect(paths.inside!.path).toBe(`${workspace}/file.txt`);
    expect(paths.inside!.exists).toBe(true);
  });

  it("reports a symlink whose target is gone as a link that is there", async () => {
    const paths = await new PathInventory({ dangling: `${workspace}/dangling` }).collect(shell);

    expect(paths.dangling).toMatchObject({ status: "present", exists: true, type: "symlink" });
  });

  it("resolves $HOME on the target rather than the home of the host process", async () => {
    const elsewhere = new Shell(new TargetProcesses(new LocalTransport().processes, { HOME: "/tmp" }));

    const paths = await new PathInventory({
      home: "$HOME",
      beneath: "$HOME/openstrap-path-inventory-nothing-here",
    }).collect(elsewhere);
    const hostHome = await shell.output('printf %s "$HOME"');

    expect(paths.home).toMatchObject({ status: "present", path: "/tmp", exists: true, type: "directory" });
    expect(paths.beneath!.path).toBe("/tmp/openstrap-path-inventory-nothing-here");
    expect(paths.home!.path).not.toBe(hostHome);
  });

  it("expands a leading ~ the way the target's shell expands $HOME", async () => {
    const paths = await new PathInventory({ tilde: "~", variable: "$HOME" }).collect(shell);

    expect(paths.variable!.path).toBe(await shell.output('printf %s "$HOME"'));
    expect(paths.tilde!.path).toBe(paths.variable!.path);
    expect(paths.tilde!.path.startsWith("/")).toBe(true);
    expect(paths.tilde).toMatchObject({ status: "present", exists: true, type: "directory" });
  });

  it("leaves a $HOME that is not at the front of the path alone", async () => {
    const literal = `${workspace}/$HOME`;

    const paths = await new PathInventory({ literal }).collect(shell);

    expect(paths.literal).toMatchObject({ status: "absent", path: literal, exists: false });
  });

  it("reads the target when collect is called, not when it is constructed", async () => {
    const appearing = `${workspace}/appears-later`;
    const inventory = new PathInventory({ appearing });

    const before = await inventory.collect(shell);
    await shell.run(`mkdir -p "${appearing}"`);
    const after = await inventory.collect(shell);

    expect(before.appearing).toMatchObject({ status: "absent", exists: false });
    expect(after.appearing).toMatchObject({ status: "present", exists: true, type: "directory" });
  });

  it("answers with a map that can be looked up by name, not a list", async () => {
    const paths = await new PathInventory({ temporary: "/tmp" }).collect(shell);

    expect(Array.isArray(paths)).toBe(false);
    expect(paths).toBeTypeOf("object");
    expect(paths).not.toHaveProperty("length");
    expect(paths).not.toHaveProperty("0");
    expect(Object.keys(paths)).toEqual(["temporary"]);
  });
});
