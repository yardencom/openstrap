import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RemoveArgsParser } from "../arguments/parsers/RemoveArgs.js";
import { RemoveCommand, RunningMachineError } from "../application/RemoveCommand.js";
import { RemoveText } from "../output/text/RemoveText.js";
import { StateHome } from "../../Store/index.js";
import { WhereMachinesAreRecorded } from "../application/WhereMachinesAreRecorded.js";
import type { OpenStrapServer } from "../../Api/index.js";
import type { MachineStatus, Provider } from "../../Plugin/index.js";

const at = "2026-09-18T10:00:00.000Z";
let home: string;
let seeding: WhereMachinesAreRecorded;
const opened = () => new WhereMachinesAreRecorded(undefined, new StateHome({ OPENSTRAP_STATE_HOME: home }));

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "openstrap-remove-"));
  seeding = opened();
});

afterEach(() => {
  seeding.close();
  rmSync(home, { recursive: true, force: true });
});

function holding(machines: Record<string, MachineStatus>, options: { failing?: boolean } = {}) {
  const deleted: string[] = [];
  const provider = {
    id: "utm",
    find: async (name: string) => {
      if (options.failing) {
        throw new Error("UTM is not running");
      }
      return name in machines ? { id: `UUID-${name}`, name } : null;
    },
    inspect: async (handle: { name: string }) => ({ status: machines[handle.name]! }),
    delete: async (handle: { name: string }) => void deleted.push(handle.name),
  } as unknown as Provider;

  return { provider, deleted };
}

function removing(providers: Record<string, Provider>, words: string[], where = opened) {
  const runtime = { providers: { get: (id: string) => providers[id] } };
  return new RemoveCommand(async () => where()).execute(
    new RemoveArgsParser().parse(words),
    { workspaceRoot: process.cwd(), runtime: () => Promise.resolve(runtime as never) },
  );
}

function made(name: string, provider?: string): void {
  seeding.local.machines.save({ name, scope: "guest", type: "vm", provider, transport: "ssh" }, at);
  seeding.local.machines.pin(name, {
    reference: "ubuntu:24.04", url: "https://images.example/noble.img", sha256: "a".repeat(64),
    platform: "linux", architecture: "arm64", format: "qcow2", boot: "uefi",
  }, at);
}

describe("openstrap remove", () => {
  it("wants one target and nothing else", () => {
    expect(new RemoveArgsParser().parse(["vm", "--force"])).toMatchObject({ target: "vm", force: true });
    expect(() => new RemoveArgsParser().parse([])).toThrow(/Usage/);
    expect(() => new RemoveArgsParser().parse(["one", "two"])).toThrow(/Usage/);
  });

  it("deletes a stopped machine where its provider holds it, and forgets the record with everything pinned to it", async () => {
    made("ubuntu-vm", "utm");
    const utm = holding({ "ubuntu-vm": "stopped" });

    const removed = await removing({ utm: utm.provider }, ["ubuntu-vm"]);

    expect(removed.result).toEqual({ target: "ubuntu-vm", provider: "utm", machine: "deleted" });
    expect(utm.deleted).toEqual(["ubuntu-vm"]);
    expect(seeding.local.machines.read("ubuntu-vm")).toBeNull();
    expect(seeding.local.machines.pinOf("ubuntu-vm")).toBeNull();
  });

  it("refuses a running machine unless forced, because that is a computer somebody may be on", async () => {
    made("ubuntu-vm", "utm");
    const utm = holding({ "ubuntu-vm": "running" });

    await expect(removing({ utm: utm.provider }, ["ubuntu-vm"])).rejects.toBeInstanceOf(RunningMachineError);
    expect(utm.deleted).toEqual([]);
    expect(seeding.local.machines.read("ubuntu-vm")).not.toBeNull();

    const forced = await removing({ utm: utm.provider }, ["ubuntu-vm", "--force"]);
    expect(forced.result.machine).toBe("deleted");
    expect(utm.deleted).toEqual(["ubuntu-vm"]);
  });

  it("drops a record whose machine the provider no longer has, which is what a missing row is", async () => {
    made("old-probe", "utm");
    const utm = holding({});

    const removed = await removing({ utm: utm.provider }, ["old-probe"]);

    expect(removed.result).toEqual({ target: "old-probe", provider: "utm", machine: "none", detail: "utm had no machine by that name" });
    expect(seeding.local.machines.read("old-probe")).toBeNull();
  });

  it("drops a record that never said which provider held it", async () => {
    made("nothing-says");

    const removed = await removing({}, ["nothing-says"]);

    expect(removed.result).toMatchObject({ machine: "none", detail: "nothing recorded which provider held it" });
    expect(seeding.local.machines.read("nothing-says")).toBeNull();
  });

  it("will not orphan a machine behind a plugin that is not here, unless forced", async () => {
    made("prod-web", "hetzner");

    await expect(removing({}, ["prod-web"])).rejects.toThrow(/no hetzner plugin/);
    expect(seeding.local.machines.read("prod-web")).not.toBeNull();

    const forced = await removing({}, ["prod-web", "--force"]);
    expect(forced.result.detail).toMatch(/left where it is/);
    expect(seeding.local.machines.read("prod-web")).toBeNull();
  });

  it("keeps the record when the provider cannot be asked, unless forced", async () => {
    made("ubuntu-vm", "utm");
    const utm = holding({}, { failing: true });

    await expect(removing({ utm: utm.provider }, ["ubuntu-vm"])).rejects.toThrow(/UTM is not running/);
    expect(seeding.local.machines.read("ubuntu-vm")).not.toBeNull();

    const forced = await removing({ utm: utm.provider }, ["ubuntu-vm", "--force"]);
    expect(forced.result.detail).toMatch(/did not delete it.*left where it is/);
    expect(seeding.local.machines.read("ubuntu-vm")).toBeNull();
  });

  it("says so when nothing by that name is recorded", async () => {
    await expect(removing({}, ["never-made"])).rejects.toThrow(/no machine called "never-made"/);
  });

  it("does not reach into a server's record, and says how to remove this computer's own", async () => {
    made("ubuntu-vm", "utm");
    const onServer = () => new WhereMachinesAreRecorded({} as OpenStrapServer, new StateHome({ OPENSTRAP_STATE_HOME: home }));

    await expect(removing({}, ["ubuntu-vm"], onServer)).rejects.toThrow(/--local/);
    expect(seeding.local.machines.read("ubuntu-vm")).not.toBeNull();
  });
});

describe("What remove says", () => {
  it("names what happened to the machine and that the record is gone", () => {
    expect(new RemoveText().print({ target: "vm", provider: "utm", machine: "deleted" }))
      .toBe("vm: machine deleted in utm; record removed.\n");
    expect(new RemoveText().print({ target: "vm", provider: "utm", machine: "none", detail: "utm had no machine by that name" }))
      .toBe("vm: utm had no machine by that name; record removed.\n");
  });
});
