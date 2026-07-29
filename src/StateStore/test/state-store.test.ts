import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteStateStore } from "../index.js";
import { stateStoreSchema } from "../adapters/sqlite/Schema.js";

const now = "2026-07-27T10:00:00.000Z";

describe("State store", () => {
  let store: SqliteStateStore;

  beforeEach(() => {
    store = new SqliteStateStore(":memory:");
    store.saveTarget({ name: "ubuntu-vm", scope: "guest", type: "vm", provider: "utm", transport: "ssh" }, now);
  });

  afterEach(() => {
    store.close();
  });

  it("records a target once however often it is declared", () => {
    store.saveTarget({ name: "ubuntu-vm", scope: "guest", type: "vm", provider: "utm", transport: "ssh" }, now);

    expect(store.listTargets()).toHaveLength(1);
    expect(store.readTarget("ubuntu-vm")).toMatchObject({ provider: "utm", transport: "ssh" });
  });

  it("does not know a target it was never told about", () => {
    expect(store.readTarget("absent")).toBeNull();
  });

  it("keeps every declaration as its own revision of the desired state", () => {
    expect(store.saveDesiredState("ubuntu-vm", { size: "medium" }, now)).toBe(1);
    expect(store.saveDesiredState("ubuntu-vm", { size: "large" }, now)).toBe(2);
    expect(store.readDesiredState("ubuntu-vm")).toEqual({ revision: 2, declaration: { size: "large" } });
  });

  it("records a run and the steps it went through", () => {
    store.startRun({ id: "run-1", target: "ubuntu-vm", command: "create", startedAt: now });
    store.recordStep({ runId: "run-1", ordinal: 1, name: "resolve image", status: "succeeded", startedAt: now });
    store.recordStep({ runId: "run-1", ordinal: 2, name: "create machine", status: "running", startedAt: now });
    store.recordStep({ runId: "run-1", ordinal: 2, name: "create machine", status: "failed", startedAt: now, detail: "no space" });
    store.finishRun("run-1", "failed", now);

    expect(store.readRun("run-1")).toMatchObject({ status: "failed", finishedAt: now });
    expect(store.listSteps("run-1").map((step) => [step.name, step.status])).toEqual([
      ["resolve image", "succeeded"],
      ["create machine", "failed"],
    ]);
    expect(store.listSteps("run-1")[1]!.detail).toBe("no space");
  });

  it("maps a target to the resource the provider created", () => {
    store.saveProviderResource({ target: "ubuntu-vm", provider: "utm", resourceId: "UUID-1" }, now);

    expect(store.readProviderResource("ubuntu-vm")?.resourceId).toBe("UUID-1");
  });

  it("refuses to hand the same host port to a second target", () => {
    store.saveTarget({ name: "other-vm", scope: "guest", type: "vm", provider: "utm", transport: "ssh" }, now);
    store.allocatePort({ hostPort: 2222, target: "ubuntu-vm", guestPort: 22, protocol: "tcp" }, now);

    expect(() =>
      store.allocatePort({ hostPort: 2222, target: "other-vm", guestPort: 22, protocol: "tcp" }, now),
    ).toThrow(/already reserved for target "ubuntu-vm"/);
  });

  it("lets the same target reclaim the port it already holds", () => {
    store.allocatePort({ hostPort: 2222, target: "ubuntu-vm", guestPort: 22, protocol: "tcp" }, now);
    store.allocatePort({ hostPort: 2222, target: "ubuntu-vm", guestPort: 22, protocol: "tcp" }, now);

    expect(store.listAllocatedPorts()).toHaveLength(1);
  });

  it("frees a port once the target releases it", () => {
    store.allocatePort({ hostPort: 2222, target: "ubuntu-vm", guestPort: 22, protocol: "tcp" }, now);
    store.releasePorts("ubuntu-vm");

    expect(store.listAllocatedPorts()).toEqual([]);
  });

  it("stores where a secret lives, never the secret", () => {
    store.saveSecretReference({ target: "ubuntu-vm", purpose: "ssh-identity", store: "keychain", name: "openstrap.ubuntu-vm" }, now);

    const reference = store.readSecretReference("ubuntu-vm", "ssh-identity");

    expect(reference).toMatchObject({ store: "keychain", name: "openstrap.ubuntu-vm" });
    expect(JSON.stringify(reference)).not.toContain("PRIVATE KEY");
  });

  it("returns the most recent fact snapshot for a target", () => {
    store.saveFactSnapshot({ id: "snap-1", target: "ubuntu-vm", schemaVersion: "facts.v1", capturedAt: "2026-07-27T09:00:00.000Z", data: { os: "old" } });
    store.saveFactSnapshot({ id: "snap-2", target: "ubuntu-vm", schemaVersion: "facts.v1", capturedAt: "2026-07-27T11:00:00.000Z", data: { os: "new" } });

    expect(store.readLatestFactSnapshot("ubuntu-vm")).toMatchObject({ id: "snap-2", data: { os: "new" } });
  });

  it("forgets everything recorded about a target that is deleted", () => {
    store.startRun({ id: "run-1", target: "ubuntu-vm", command: "create", startedAt: now });
    store.allocatePort({ hostPort: 2222, target: "ubuntu-vm", guestPort: 22, protocol: "tcp" }, now);
    store.saveProviderResource({ target: "ubuntu-vm", provider: "utm", resourceId: "UUID-1" }, now);

    store.forgetTarget("ubuntu-vm");

    expect(store.readTarget("ubuntu-vm")).toBeNull();
    expect(store.readRun("run-1")).toBeNull();
    expect(store.listAllocatedPorts()).toEqual([]);
    expect(store.readProviderResource("ubuntu-vm")).toBeNull();
  });

  it("does not record a run for a target it does not know", () => {
    expect(() =>
      store.startRun({ id: "run-2", target: "absent", command: "create", startedAt: now }),
    ).toThrow();
  });

  it("holds exactly the tables the state store is meant to hold", () => {
    const tableNames = stateStoreSchema
      .flatMap((statement) => [...statement.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)])
      .map((match) => match[1]!)
      .sort();

    expect(tableNames).toEqual([
      "allocated_port",
      "desired_state",
      "fact_snapshot",
      "provider_resource",
      "run",
      "run_step",
      "secret_reference",
      "target",
    ]);
  });
});
