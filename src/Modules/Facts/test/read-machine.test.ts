import { describe, expect, it } from "vitest";

import {
  InvalidSnapshotError,
  ReadMachine,
  type FactReading,
} from "../Domain/ReadMachine.js";
import { Facts } from "../Facts.js";

const host = { name: "host", scope: "host", type: "host", transport: "local" } as const;

describe("a machine that was read", () => {
  it("pairs the run with the snapshot it produced", () => {
    const machine = new ReadMachine(reading());

    expect(machine.run.snapshotId).toBe(machine.snapshot.id);
    expect(machine.snapshot.schemaVersion).toBe("facts.v1");
  });

  it("names the snapshot and the run after the machine and the moment", () => {
    const machine = new ReadMachine(reading());

    expect(machine.snapshot.id).toBe("snap_host_20260608T100000000Z");
    expect(machine.run.id).toBe("fact_run_host_20260608T100000000Z");
  });

  it("cannot be edited after it is made", () => {
    const machine = new ReadMachine(reading());

    expect(Object.isFrozen(machine)).toBe(true);
    expect(Object.isFrozen(machine.snapshot)).toBe(true);
    expect(Object.isFrozen(machine.snapshot.data)).toBe(true);
  });

  it("keeps failures on the section that failed rather than in one bag", () => {
    expect(() => new ReadMachine(reading({ errors: ["something went wrong"] })))
      .toThrow(InvalidSnapshotError);
    expect(() => new ReadMachine(reading({ errors: [] })))
      .toThrow(/must not contain top-level errors/);
  });

  it("records the channel it was read through", () => {
    const machine = new ReadMachine({
      ...reading(),
      transports: { ssh: { status: "present", type: "ssh", ready: true, authMethods: ["publickey"] } },
    });
    const data = machine.snapshot.data as { transports: Record<string, { authMethods?: string[] }> };

    expect(data.transports.ssh!.authMethods).toEqual(["publickey"]);
  });
});

describe("reading a machine", () => {
  it("stamps the target it read and pairs the run with the snapshot", async () => {
    const machine = await new Facts().collect({ target: host, declare: { sections: ["os", "arch"] } });

    expect(machine.snapshot.scope).toBe("host");
    expect(machine.snapshot.target).toMatchObject({ id: "host", type: "host" });
    expect(machine.run.snapshotId).toBe(machine.snapshot.id);
    expect(machine.run.status).toBe("success");
  });

  it("names no channel when it opened none", async () => {
    const machine = await new Facts().collect({ target: host, declare: { sections: ["os"] } });
    const data = machine.snapshot.data as { transports: Record<string, unknown> };

    // Reading in process opens nothing, so there is nothing to report. A `local` transport
    // written here would be an invention, and a requirement about it used to pass against
    // exactly that.
    expect(data.transports).toEqual({});
  });

  it("reads the machine it is running on when given no transport", async () => {
    const machine = await new Facts().collect({
      target: host,
      declare: { sections: ["os", "arch", "cpu", "memory"] },
    });
    const data = machine.snapshot.data as {
      os: { family: string; name: string; version: string };
      arch: string;
      cpu: { cores: number };
      memory: { totalBytes: number };
    };

    expect(data.os.family).toBe(process.platform === "darwin" ? "macos" : process.platform);
    expect(data.os.name).not.toBe("");
    expect(data.os.version).not.toBe("");
    expect(data.arch).toBe(process.arch);
    expect(data.cpu.cores).toBeGreaterThan(0);
    expect(data.memory.totalBytes).toBeGreaterThan(0);
  });

  it("does not read a section nobody asked about", async () => {
    const machine = await new Facts().collect({ target: host, declare: { sections: ["os"] } });
    const data = machine.snapshot.data as { processes: Record<string, unknown>; commands: Record<string, unknown> };

    expect(data.processes).toEqual({});
    expect(data.commands).toEqual({});
  });

  it("reads everything it can when the order names nothing", async () => {
    const machine = await new Facts().collect({ target: host });
    const data = machine.snapshot.data as {
      os: { name: string };
      processes: Record<string, unknown>;
      commands: Record<string, unknown>;
    };

    // "Tell me about this machine": every section that answers without being told a name does,
    // and the ones that need names stay empty rather than inventing entries.
    expect(data.os.name).not.toBe("");
    expect(Object.keys(data.processes).length).toBeGreaterThan(0);
    expect(data.commands).toEqual({});
  });

  it("marks the run a warning when any section reports a failure, whichever section it is", async () => {
    const clean = await new Facts().collect({ target: host, declare: { sections: ["os"] } });
    // root exists, but the declaration asserts a uid it does not have.
    const failed = await new Facts().collect({
      target: host,
      declare: { users: { superuser: { name: "root", uid: 1234 } } },
    });
    const data = failed.snapshot.data as { users: Record<string, { status: string }> };

    expect(clean.run.status).toBe("success");
    expect(data.users.superuser!.status).toBe("error");
    expect(failed.run.status).toBe("warning");
  });

  it("gives every snapshot a name of its own", async () => {
    const facts = new Facts();
    const first = await facts.collect({ target: host, declare: { sections: ["os"] }, now: new Date("2026-01-01T00:00:00Z") });
    const second = await facts.collect({ target: host, declare: { sections: ["os"] }, now: new Date("2026-01-02T00:00:00Z") });

    expect(first.snapshot.id).not.toBe(second.snapshot.id);
  });
});

function reading(data: Record<string, unknown> = { arch: "x64" }): FactReading {
  return {
    target: host,
    data: data as FactReading["data"],
    transports: {},
    startedAt: new Date("2026-06-08T10:00:00.000Z"),
  };
}
