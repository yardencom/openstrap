import { basename } from "node:path";

import { describe, expect, it } from "vitest";

import { EntityFacts } from "./EntityFacts.js";
import { Platform } from "./Platform.js";

const facts = new EntityFacts(Platform.current());
const otherPlatform = Platform.current().is("linux") ? "macos" : "linux";
/** This test process is a process on this machine, so the reading has to find it. */
const ownName = basename(process.execPath);

describe("processes", () => {
  it("reports the process table keyed by the identity a process has", async () => {
    const table = await facts.processes({});
    const own = table[`pid-${process.pid}`];

    expect(own).toMatchObject({ status: "present", pid: process.pid });
    expect(own!.name).toContain(ownName);
  });

  it("finds a declared process by name and answers under the caller's key", async () => {
    const table = await facts.processes({ runner: { name: ownName } });

    expect(table.runner).toMatchObject({ status: "present" });
    expect(table.runner!.pids).toContain(process.pid);
  });

  it("takes the key as the name when the caller gives no other", async () => {
    const table = await facts.processes({ [ownName]: {} });

    expect(table[ownName]!.pids).toContain(process.pid);
  });

  it("reports a declared process that matches nothing as absent", async () => {
    const table = await facts.processes({ ghost: { name: "openstrap-no-such-process" } });

    expect(table.ghost).toMatchObject({ status: "absent", pids: [] });
  });

  it("does not look for a process declared for another platform", async () => {
    const table = await facts.processes({ elsewhere: { name: ownName, platforms: [otherPlatform] } });

    expect(table.elsewhere).toMatchObject({ status: "unsupported", reason: "platform_not_selected" });
  });
});

describe("services", () => {
  it("asks nothing when nothing was declared, because no requirement asks for a list", async () => {
    expect(await facts.services({})).toEqual({});
  });

  it("reports a service that is not running as absent, whatever is installed", async () => {
    const answered = await facts.services({ ghost: { name: "openstrap-no-such-service" } });

    expect(answered.ghost).toMatchObject({
      status: "absent",
      name: "openstrap-no-such-service",
      running: false,
      pids: [],
    });
  });

  it("finds a running service and says which processes are serving it", async () => {
    // launchd is pid 1 on macOS and systemd is pid 1 on Linux, so one of the two
    // is running wherever this test runs.
    const answered = await facts.services({ init: { name: Platform.current().is("macos") ? "launchd" : "systemd" } });

    expect(answered.init).toMatchObject({ status: "present", running: true, state: "running" });
    expect(answered.init!.pids).toContain(1);
  });

  it("names the manager that answered for the service", async () => {
    const answered = await facts.services({ ghost: { name: "openstrap-no-such-service" } });

    expect(answered.ghost!.manager).toBe(Platform.current().is("macos") ? "launchd" : "systemd");
  });

  it("does not ask about a service declared for another platform", async () => {
    const answered = await facts.services({ elsewhere: { name: "sshd", platforms: [otherPlatform] } });

    expect(answered.elsewhere).toMatchObject({ status: "unsupported", reason: "platform_not_selected" });
  });
});

describe("tools", () => {
  it("reports where a tool is and what version it says it is", async () => {
    const answered = await facts.tools({ node: {} });

    expect(answered.node).toMatchObject({ status: "present", name: "node", executable: true });
    expect(answered.node!.path).toContain("node");
    expect(answered.node!.version).toMatch(/^\d+\.\d+/);
  });

  it("reports a tool that does not resolve on PATH as absent", async () => {
    expect(await facts.tools({ missing: { name: "openstrap-no-such-tool" } })).toMatchObject({
      missing: { status: "absent", name: "openstrap-no-such-tool", executable: false },
    });
  });

  it("reads the tools every blueprint asks about when nothing is declared", async () => {
    const answered = await facts.tools({});

    expect(Object.keys(answered)).toEqual(["node", "npm", "python3", "git"]);
  });

  it("answers under the caller's key rather than the tool's name", async () => {
    const answered = await facts.tools({ theRuntime: { name: "node" } });

    expect(answered.theRuntime).toMatchObject({ status: "present", name: "node" });
  });
});

describe("runtimes", () => {
  it("derives a runtime from the tool that provides it, so the two cannot disagree", async () => {
    const tools = await facts.tools({ node: {} });
    const runtimes = facts.runtimes(tools);

    expect(runtimes.node).toMatchObject({ status: "present", type: "node", ready: true });
    expect(runtimes.node!.version).toBe(tools.node!.version);
  });

  it("offers no runtime for a tool that is not one", async () => {
    expect(facts.runtimes(await facts.tools({ git: {} }))).toEqual({});
  });

  it("offers no runtime for a tool that is absent", () => {
    expect(facts.runtimes({ node: { status: "absent", name: "node", executable: false } })).toEqual({});
  });
});

describe("installed packages", () => {
  it("says openstrap did not look rather than that the package is missing", () => {
    expect(facts.packages({ openssl: { names: ["openssl"], manager: "auto" } })).toEqual({
      openssl: {
        status: "unsupported",
        name: "openssl",
        manager: "auto",
        reason: "installed_packages_not_read",
      },
    });
  });

  it("answers every name a declaration lists", () => {
    expect(Object.keys(facts.packages({ tools: { names: ["npm", "uv"] } }))).toEqual(["tools.npm", "tools.uv"]);
  });
});
