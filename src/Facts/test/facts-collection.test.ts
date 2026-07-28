import { describe, expect, it } from "vitest";

import {
  createFactCollection,
  FactCollectionValidationError,
  type FactCollectionItem,
} from "../Domain/FactCollection.js";
import { Facts } from "../Facts.js";

describe("fact collections", () => {
  it("rejects an empty collection", () => {
    expect(() => createFactCollection([])).toThrow(FactCollectionValidationError);
  });

  it("requires every run to point at the snapshot it produced", () => {
    expect(() =>
      createFactCollection([
        {
          snapshot: minimalItem().snapshot,
          run: { ...minimalItem().run, snapshotId: "different_snapshot" },
        },
      ]),
    ).toThrow(/snapshotId/);
  });

  it("keeps why a snapshot was taken out of the snapshot", () => {
    for (const key of ["profile", "purpose", "provenance", "metadata", "sources", "confidence"]) {
      expect(() =>
        createFactCollection([
          {
            ...minimalItem(),
            snapshot: { ...minimalItem().snapshot, [key]: "not-allowed" } as never,
          },
        ]),
      ).toThrow(FactCollectionValidationError);
    }
  });

  it("keeps failures on the section that failed rather than in one bag", () => {
    expect(() =>
      createFactCollection([
        {
          ...minimalItem(),
          snapshot: {
            ...minimalItem().snapshot,
            data: { errors: ["something went wrong"] },
          },
        },
      ]),
    ).toThrow(/errors/);
  });

  it("cannot be edited after it is made", () => {
    const collection = createFactCollection([minimalItem()]);

    expect(Object.isFrozen(collection)).toBe(true);
    expect(Object.isFrozen(collection[0]!.snapshot)).toBe(true);
  });
});

describe("reading a machine", () => {
  it("stamps the target it read and pairs the run with the snapshot", async () => {
    const facts = await new Facts().collect({
      target: { name: "host", scope: "host", type: "host", transport: "local" },
      declare: { sections: ["os", "arch"] },
    });

    expect(facts).toHaveLength(1);
    expect(facts[0]!.snapshot.scope).toBe("host");
    expect(facts[0]!.snapshot.target).toMatchObject({ id: "host", type: "host" });
    expect(facts[0]!.run.snapshotId).toBe(facts[0]!.snapshot.id);
    expect(facts[0]!.run.status).toBe("success");
  });

  it("names no channel when it opened none", async () => {
    const facts = await new Facts().collect({
      target: { name: "host", scope: "host", type: "host", transport: "local" },
      declare: { sections: ["os"] },
    });
    const data = facts[0]!.snapshot.data as { transports: Record<string, unknown> };

    // Reading in process opens nothing, so there is nothing to report. A `local`
    // transport written here would be an invention, and a requirement about it
    // used to pass against exactly that.
    expect(data.transports).toEqual({});
  });

  it("reads the machine it is running on when given no transport", async () => {
    const facts = await new Facts().collect({
      target: { name: "host", scope: "host", type: "host", transport: "local" },
      declare: { sections: ["os", "arch", "cpu", "memory"] },
    });
    const data = facts[0]!.snapshot.data as {
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
    const facts = await new Facts().collect({
      target: { name: "host", scope: "host", type: "host", transport: "local" },
      declare: { sections: ["os"] },
    });
    const data = facts[0]!.snapshot.data as { processes: Record<string, unknown>; commands: Record<string, unknown> };

    expect(data.processes).toEqual({});
    expect(data.commands).toEqual({});
  });

  it("marks the run a warning when any section reports a failure, whichever section it is", async () => {
    const target = { name: "host", scope: "host", type: "host", transport: "local" } as const;
    const clean = await new Facts().collect({ target, declare: { sections: ["os"] } });
    // root exists, but the declaration asserts a uid it does not have.
    const failed = await new Facts().collect({
      target,
      declare: { users: { superuser: { name: "root", uid: 1234 } } },
    });
    const data = failed[0]!.snapshot.data as { users: Record<string, { status: string }> };

    expect(clean[0]!.run.status).toBe("success");
    expect(data.users.superuser!.status).toBe("error");
    expect(failed[0]!.run.status).toBe("warning");
  });

  it("gives every snapshot a name of its own", async () => {
    const facts = new Facts();
    const target = { name: "host", scope: "host", type: "host", transport: "local" } as const;
    const first = await facts.collect({ target, declare: { sections: ["os"] }, now: new Date("2026-01-01T00:00:00Z") });
    const second = await facts.collect({ target, declare: { sections: ["os"] }, now: new Date("2026-01-02T00:00:00Z") });

    expect(first[0]!.snapshot.id).not.toBe(second[0]!.snapshot.id);
  });
});

function minimalItem(): FactCollectionItem {
  return {
    snapshot: {
      id: "snap_host",
      schemaVersion: "facts.v1",
      scope: "host",
      target: { type: "machine", id: "host" },
      data: { arch: "x64" },
    },
    run: {
      id: "fact_run_host",
      snapshotId: "snap_host",
      startedAt: "2026-06-08T10:00:00.000Z",
      finishedAt: "2026-06-08T10:00:00.000Z",
      status: "success",
      attempt: 1,
    },
  };
}
