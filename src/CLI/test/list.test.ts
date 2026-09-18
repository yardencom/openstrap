import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ListCommand } from "../application/ListCommand.js";
import { ListText } from "../output/text/ListText.js";
import { Palette } from "../output/text/Palette.js";
import { StateHome } from "../../Store/index.js";
import { WhereMachinesAreRecorded } from "../application/WhereMachinesAreRecorded.js";
import type { MachineStatus, Provider } from "../../Plugin/index.js";

const at = "2026-08-14T10:00:00.000Z";

let home: string;
let seeding: WhereMachinesAreRecorded;

/** A connection of the test's own: the command opens and closes one of its own, as it does in life. */
const opened = () => new WhereMachinesAreRecorded(undefined, new StateHome({ OPENSTRAP_STATE_HOME: home }));

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "openstrap-list-"));
  seeding = opened();
});

afterEach(() => {
  seeding.close();
  rmSync(home, { recursive: true, force: true });
});

/** A provider holding whichever machines it is told to hold, in whatever state. */
function holding(machines: Record<string, MachineStatus>, options: { failing?: boolean } = {}): Provider {
  return {
    id: "utm",
    find: async (name: string) => {
      if (options.failing) {
        throw new Error("UTM is not running");
      }

      return name in machines ? { id: `UUID-${name}`, name } : null;
    },
    inspect: async (handle: { name: string }) => ({ status: machines[handle.name]! }),
  } as unknown as Provider;
}

function listing(providers: Record<string, Provider>) {
  const runtime = { providers: { get: (id: string) => providers[id] } };

  return new ListCommand(async () => opened()).execute(
    { command: "list", json: false, local: false, pluginSpecifiers: [] },
    { workspaceRoot: process.cwd(), runtime: () => Promise.resolve(runtime as never) },
  );
}

function made(name: string, provider: string): void {
  seeding.local.machines.save({ name, scope: "guest", type: "vm", provider, transport: "ssh" }, at);
  seeding.local.machines.pin(name, {
    reference: "ubuntu:24.04", url: "https://images.example/noble.img", sha256: "a".repeat(64),
    platform: "linux", architecture: "arm64", format: "qcow2", boot: "uefi",
  }, at);
}

describe("What each machine is doing", () => {
  it("is asked of the provider holding it, because a stored status is a guess with a timestamp", async () => {
    made("ubuntu-vm", "utm");

    const listed = await listing({ utm: holding({ "ubuntu-vm": "running" }) });

    expect(listed.result.machines).toEqual([{
      name: "ubuntu-vm",
      provider: "utm",
      transport: "ssh",
      image: { reference: "ubuntu:24.04", sha256: "a".repeat(64) },
      host: undefined,
      status: "running",
    }]);
  });

  it("is missing where the provider has no such machine, because the record outlived it", async () => {
    made("ubuntu-vm", "utm");

    const listed = await listing({ utm: holding({}) });

    expect(listed.result.machines[0]).toMatchObject({
      status: "missing",
      detail: "utm has no machine by that name",
    });
  });

  it("is unreachable where the plugin holding it is not on this computer, and says which", async () => {
    made("prod-web", "hetzner");

    const listed = await listing({ utm: holding({}) });

    expect(listed.result.machines[0]).toMatchObject({
      status: "unreachable",
      detail: "no hetzner plugin on this computer",
    });
  });

  it("is unreachable with the reason when the provider itself fails to answer", async () => {
    made("ubuntu-vm", "utm");

    const listed = await listing({ utm: holding({}, { failing: true }) });

    expect(listed.result.machines[0]).toMatchObject({ status: "unreachable", detail: "UTM is not running" });
  });

  it("does not let one unanswerable machine hide the rest", async () => {
    made("ubuntu-vm", "utm");
    made("prod-web", "hetzner");

    const listed = await listing({ utm: holding({ "ubuntu-vm": "stopped" }) });

    expect(listed.result.machines.map((machine) => [machine.name, machine.status])).toEqual([
      ["prod-web", "unreachable"],
      ["ubuntu-vm", "stopped"],
    ]);
  });

  it("leaves out the computer the question is being asked on, which is not a machine anybody made", async () => {
    seeding.local.machines.save({ name: "local", scope: "host", type: "host", transport: "local" }, at);
    made("ubuntu-vm", "utm");

    const listed = await listing({ utm: holding({ "ubuntu-vm": "running" }) });

    expect(listed.result.machines.map((machine) => machine.name)).toEqual(["ubuntu-vm"]);
  });

  it("says which record answered, so a short list is not mistaken for an empty world", async () => {
    const listed = await listing({});

    expect(listed.result.from).toBe("here");
  });
});

describe("Every machine on one line", () => {
  it("says nothing is here rather than printing an empty table", () => {
    expect(new ListText().print({ machines: [], from: "here" })).toMatch(/No machines have been made/);
  });

  it("says the organization has none, where a server is the record", () => {
    expect(new ListText().print({ machines: [], from: "server" })).toMatch(/organization has no machines/);
  });

  it("makes each column as wide as the widest thing in it", () => {
    const printed = new ListText().print({
      from: "here",
      machines: [
        { name: "vm", status: "running", provider: "utm", image: { reference: "ubuntu:24.04", sha256: "a" } },
        { name: "longer-name", status: "stopped", provider: "utm", image: { reference: "ubuntu:24.04", sha256: "a" } },
      ],
    });

    expect(printed.split("\n")).toEqual([
      "NAME         STATUS   PROVIDER  IMAGE",
      "vm           running  utm       ubuntu:24.04",
      "",
      "longer-name  stopped  utm       ubuntu:24.04",
      "",
    ]);
  });

  it("leaves no trailing spaces, because a line in a pipe is compared as it is", () => {
    const printed = new ListText().print({
      from: "here",
      machines: [{ name: "vm", status: "running", provider: "utm" }],
    });

    expect(printed).toBe("NAME  STATUS   PROVIDER  IMAGE\nvm    running  utm       —\n");
  });

  it("puts what a person can act on first and what is gone last, a blank line between", () => {
    const printed = new ListText().print({
      from: "here",
      machines: [
        { name: "b-gone", status: "missing", provider: "utm", detail: "utm has no machine by that name" },
        { name: "a-gone", status: "missing", provider: "utm", detail: "utm has no machine by that name" },
        { name: "asleep", status: "stopped", provider: "utm" },
        { name: "lost", status: "unreachable", detail: "nothing recorded which provider holds it" },
        { name: "awake", status: "running", provider: "utm" },
      ],
    });
    const lines = printed.split("\n");
    expect(lines.filter((line) => line !== "").map((line) => line.split(/\s+/)[0])).toEqual([
      "NAME", "awake", "asleep", "lost", "a-gone", "b-gone",
    ]);
    expect(lines.filter((line) => line === "")).toHaveLength(4);
  });

  it("colours a status only where a person is looking, and never widens a column doing it", () => {
    const machines = [{ name: "vm", status: "running" as const, provider: "utm" }];
    const plain = new ListText(Palette.plain()).print({ from: "here", machines });
    const coloured = new ListText(Palette.forStream({ isTTY: true }, { TERM: "xterm-256color" })).print({ from: "here", machines });

    expect(coloured).toContain("\u001b[32mrunning\u001b[0m");
    expect(coloured.replace(/\u001b\[\d+m/g, "")).toBe(plain);
    expect(new ListText(Palette.forStream({ isTTY: true }, { NO_COLOR: "1" })).print({ from: "here", machines })).toBe(plain);
    expect(new ListText(Palette.forStream({ isTTY: false }, {})).print({ from: "here", machines })).toBe(plain);
  });
});
