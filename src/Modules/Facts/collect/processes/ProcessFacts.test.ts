import { basename } from "node:path";

import { describe, expect, it } from "vitest";

import { ProcessFacts } from "./ProcessFacts.js";
import { Platform } from "../platform/Platform.js";

const facts = new ProcessFacts(Platform.current());
/** This test process is a process on this machine, so the reading has to find it. */
const ownName = basename(process.execPath);
const otherPlatform = Platform.current().is("linux") ? "macos" : "linux";

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
