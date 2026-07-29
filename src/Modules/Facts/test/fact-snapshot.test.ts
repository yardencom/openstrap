import { describe, expect, it } from "vitest";

import { FactSnapshot } from "../domain/FactSnapshot.js";
import type { FactSections } from "../domain/FactModel.js";
import { MachineFacts } from "../domain/MachineFacts.js";
import { Moment } from "../domain/Moment.js";
import { Facts } from "../Facts.js";

const host = { name: "host", scope: "host", type: "host", transport: "local" } as const;

describe("making a snapshot", () => {
  it("names it after the machine and the moment it was taken", () => {
    const snapshot = snapshotOf();

    expect(String(snapshot.id)).toBe("snap_host_20260608T100000000Z");
    // The id is a type that knows how it is spelled, and spells itself the same way into JSON.
    expect(JSON.parse(JSON.stringify(snapshot)).id).toBe("snap_host_20260608T100000000Z");
    expect(snapshot.schemaVersion).toBe("facts.v1");
  });

  it("says which machine it is about, and how the reading went", () => {
    const snapshot = snapshotOf();

    expect(snapshot.scope).toBe("host");
    expect(snapshot.target).toEqual({ type: "host", id: "host", displayName: undefined });
    expect(String(snapshot.reading.takenAt)).toBe("2026-06-08T10:00:00.000Z");
    expect(snapshot.reading.status).toBe("success");
  });

  it("cannot be edited after it is made", () => {
    const snapshot = snapshotOf();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.facts)).toBe(true);
    expect(Object.isFrozen(snapshot.reading)).toBe(true);
  });

  it("calls a reading a warning when any section reports a failure", () => {
    const failed = snapshotOf({ users: { root: { status: "error", name: "root" } } });

    expect(failed.reading.status).toBe("warning");
    expect(snapshotOf().reading.status).toBe("success");
  });
});

describe("reading a machine", () => {
  it("stamps the target it read", async () => {
    const snapshot = await new Facts().collect({ target: host, declare: { sections: ["os", "arch"] } });

    expect(snapshot.scope).toBe("host");
    expect(snapshot.target).toMatchObject({ id: "host", type: "host" });
    expect(String(snapshot.id)).toMatch(/^snap_host_/);
    expect(snapshot.reading.status).toBe("success");
  });

  it("names no channel when it opened none", async () => {
    const snapshot = await new Facts().collect({ target: host, declare: { sections: ["os"] } });

    // Reading in process opens nothing, so there is nothing to report. A `local` transport written
    // here would be an invention, and a requirement about it used to pass against exactly that.
    expect(snapshot.facts.transports).toEqual({});
  });

  it("reads the machine it is running on when given no transport", async () => {
    const snapshot = await new Facts().collect({
      target: host,
      declare: { sections: ["os", "arch", "cpu", "memory"] },
    });

    expect(snapshot.facts.os.family).toBe(process.platform === "darwin" ? "macos" : process.platform);
    expect(snapshot.facts.os.name).not.toBe("");
    expect(snapshot.facts.os.version).not.toBe("");
    expect(snapshot.facts.arch).toBe(process.arch);
    expect(snapshot.facts.cpu.cores).toBeGreaterThan(0);
    expect(snapshot.facts.memory.totalBytes).toBeGreaterThan(0);
  });

  it("does not read a section nobody asked about", async () => {
    const snapshot = await new Facts().collect({ target: host, declare: { sections: ["os"] } });

    expect(snapshot.facts.processes).toEqual({});
    expect(snapshot.facts.commands).toEqual({});
  });

  it("reads everything it can when the order names nothing", async () => {
    const snapshot = await new Facts().collect({ target: host });

    // "Tell me about this machine": every section that answers without being told a name does, and
    // the ones that need names stay empty rather than inventing entries.
    expect(snapshot.facts.os.name).not.toBe("");
    expect(Object.keys(snapshot.facts.processes).length).toBeGreaterThan(0);
    expect(snapshot.facts.commands).toEqual({});
  });

  it("marks the reading a warning when any section reports a failure, whichever section it is", async () => {
    const clean = await new Facts().collect({ target: host, declare: { sections: ["os"] } });
    // root exists, but the declaration asserts a uid it does not have.
    const failed = await new Facts().collect({
      target: host,
      declare: { users: { superuser: { name: "root", uid: 1234 } } },
    });

    expect(clean.reading.status).toBe("success");
    expect(failed.facts.users.superuser!.status).toBe("error");
    expect(failed.reading.status).toBe("warning");
  });

  it("gives every snapshot a name of its own", async () => {
    const facts = new Facts();
    const first = await facts.collect({ target: host, declare: { sections: ["os"] }, now: new Date("2026-01-01T00:00:00Z") });
    const second = await facts.collect({ target: host, declare: { sections: ["os"] }, now: new Date("2026-01-02T00:00:00Z") });

    expect(String(first.id)).not.toBe(String(second.id));
  });
});

function snapshotOf(sections: Record<string, unknown> = { arch: "x64" }): FactSnapshot {
  return new FactSnapshot(
    host,
    new MachineFacts(sections as unknown as FactSections),
    new Moment(new Date("2026-06-08T10:00:00.000Z")),
  );
}
