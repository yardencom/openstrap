import { describe, expect, it } from "vitest";

import {
  createFactCollection,
  FactCollectionPlanner,
  FactCollectionValidationError,
  LocalProcessFactCollector,
  type FactCollectionItem,
} from "../index.js";

describe("Facts", () => {
  it("rejects empty FactCollection payloads", () => {
    expect(() => createFactCollection([])).toThrow(FactCollectionValidationError);
  });

  it("requires FactRun snapshotId to point at the paired snapshot", () => {
    expect(() =>
      createFactCollection([
        {
          snapshot: minimalItem().snapshot,
          run: {
            ...minimalItem().run,
            snapshotId: "different_snapshot",
          },
        },
      ]),
    ).toThrow(/snapshotId/);
  });

  it("rejects profile, purpose, provenance, and metadata in FactSnapshot payloads", () => {
    for (const key of ["profile", "purpose", "provenance", "metadata"]) {
      expect(() =>
        createFactCollection([
          {
            ...minimalItem(),
            snapshot: {
              ...minimalItem().snapshot,
              [key]: "not-allowed",
            } as any,
          },
        ]),
      ).toThrow(FactCollectionValidationError);
    }
  });

  it("collects separate host and guest snapshots using local process transport", () => {
    const collection = new LocalProcessFactCollector().collect(new FactCollectionPlanner().plan({
      targets: [
        {
          name: "host",
          scope: "host",
          type: "machine",
          transport: "local",
        },
        {
          name: "guest",
          scope: "guest",
          type: "vm",
          transport: "local",
        },
      ],
      requirements: [
        {
          id: "host-runtime",
          target: "host",
          runtimes: {
            node: {
              ready: true,
            },
          },
        },
        {
          id: "guest-runtime",
          target: "guest",
          runtimes: {
            node: {
              ready: true,
            },
          },
        },
      ],
      now: new Date("2026-06-08T10:00:00.000Z"),
    }));

    expect(collection).toHaveLength(2);
    expect(collection[0]!.snapshot.scope).toBe("host");
    expect(collection[1]!.snapshot.scope).toBe("guest");
    expect(collection[0]!.snapshot.data).toHaveProperty("providers");
    expect(collection[1]!.snapshot.data).not.toHaveProperty("providers");
    expect((collection[0]!.snapshot.data as any).transports.local.ready).toBe(true);
    expect(collection[0]!.snapshot).not.toHaveProperty("profile");
    expect(collection[0]!.snapshot).not.toHaveProperty("purpose");
  });

  it("builds collection requests from requirements and represents requested unsupported selectors", () => {
    const collection = new LocalProcessFactCollector().collect(new FactCollectionPlanner().plan({
      targets: [
        {
          name: "host",
          scope: "host",
          type: "machine",
          transport: "local",
        },
      ],
      requirements: [
        {
          id: "ssh-service",
          target: "host",
          services: {
            ssh: {
              running: true,
            },
          },
        },
      ],
      now: new Date("2026-06-08T10:00:00.000Z"),
    }));

    expect((collection[0]!.snapshot.data as any).services.ssh).toEqual({
      status: "unsupported",
      reason: "local_process_probe_not_declared",
    });
  });
});

function minimalItem(): FactCollectionItem {
  return {
    snapshot: {
      id: "snap_host",
      schemaVersion: "facts.v1",
      scope: "host",
      target: {
        type: "machine",
        id: "host",
      },
      data: {
        os: {
          family: "linux",
          name: "linux",
          version: "1",
        },
        arch: "x64",
        cpu: {
          cores: 1,
        },
        memory: {
          totalBytes: 1,
        },
        storage: {
          mounts: {},
        },
        network: {
          interfaces: {},
          dns: {},
          ports: {},
          firewall: {
            status: "unknown",
          },
          reachability: {},
        },
        users: {},
        packages: {
          managers: {},
        },
        processes: {},
        services: {},
        transports: {},
        privileges: {},
        runtimes: {},
        providers: {},
        caches: {},
      },
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
