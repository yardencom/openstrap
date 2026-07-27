import { describe, expect, it } from "vitest";

import {
  createFactCollection,
  FactCollectionValidationError,
} from "../Domain/FactCollectionFactory.js";
import type { FactCollectionItem } from "../Domain/Facts.js";
import { LocalTransport } from "../../Transport/index.js";
import { Facts } from "../Facts.js";

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

  it("reads a machine over a transport and stamps the target it read", async () => {
    const facts = await Facts.read({
      transport: new LocalTransport(),
      target: { name: "host", scope: "host", type: "host", transport: "local" },
      sections: ["os", "arch"],
    });

    expect(facts).toHaveLength(1);
    expect(facts[0]!.snapshot.scope).toBe("host");
    expect(facts[0]!.snapshot.target).toMatchObject({ id: "host", type: "host" });
    expect(facts[0]!.run.status).toBe("success");
  });

  it("pairs every run with the snapshot it produced", async () => {
    const facts = await Facts.read({
      transport: new LocalTransport(),
      target: { name: "host", scope: "host", type: "host", transport: "local" },
      sections: ["os"],
    });

    expect(facts[0]!.run.snapshotId).toBe(facts[0]!.snapshot.id);
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
