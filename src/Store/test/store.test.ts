import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Store } from "../index.js";
import { migrations } from "../Migrations.js";

const now = "2026-07-27T10:00:00.000Z";

describe("State store", () => {
  let store: Store;

  beforeEach(() => {
    store = new Store(":memory:");
    store.machines.save({ name: "ubuntu-vm", scope: "guest", type: "vm", provider: "utm", transport: "ssh" }, now);
  });

  afterEach(() => {
    store.close();
  });

  it("records a target once however often it is declared", () => {
    store.machines.save({ name: "ubuntu-vm", scope: "guest", type: "vm", provider: "utm", transport: "ssh" }, now);

    expect(store.machines.list()).toHaveLength(1);
    expect(store.machines.read("ubuntu-vm")).toMatchObject({ provider: "utm", transport: "ssh" });
  });

  it("does not know a target it was never told about", () => {
    expect(store.machines.read("absent")).toBeNull();
  });

  it("keeps every declaration as its own revision of the desired state", () => {
    expect(store.machines.declare("ubuntu-vm", { size: "medium" }, now)).toBe(1);
    expect(store.machines.declare("ubuntu-vm", { size: "large" }, now)).toBe(2);
    expect(store.machines.declaration("ubuntu-vm")).toEqual({ revision: 2, declaration: { size: "large" } });
  });

  it("records a run and the steps it went through", () => {
    store.runs.start({ id: "run-1", target: "ubuntu-vm", command: "create", startedAt: now });
    store.runs.recordStep({ runId: "run-1", ordinal: 1, name: "resolve image", status: "succeeded", startedAt: now });
    store.runs.recordStep({ runId: "run-1", ordinal: 2, name: "create machine", status: "running", startedAt: now });
    store.runs.recordStep({ runId: "run-1", ordinal: 2, name: "create machine", status: "failed", startedAt: now, detail: "no space" });
    store.runs.finish("run-1", "failed", now);
    store.machines.declare("ubuntu-vm", { name: "ubuntu-vm" }, now);

    const [waiting] = store.carried.waiting();

    expect(waiting).toMatchObject({ id: "run-1", status: "failed" });
    expect(waiting!.steps.map((step) => [step.name, step.status])).toEqual([
      ["resolve image", "succeeded"],
      ["create machine", "failed"],
    ]);
    expect(waiting!.steps[1]!.detail).toBe("no space");
  });

  it("keeps the verdict a run reached, so it can travel with the rest of what happened", () => {
    store.runs.start({ id: "run-1", target: "ubuntu-vm", command: "create", startedAt: now });
    store.runs.recordVerdict({
      id: "req-1",
      target: "ubuntu-vm",
      runId: "run-1",
      status: "satisfied",
      evaluatedAt: now,
      results: [{ id: "kubernetes-running", status: "satisfied" }],
    });

    expect(store.runs.verdictFrom("run-1")).toMatchObject({
      id: "req-1",
      status: "satisfied",
      results: [{ id: "kubernetes-running", status: "satisfied" }],
    });
  });

  it("does not record a run for a target it does not know", () => {
    expect(() =>
      store.runs.start({ id: "run-2", target: "absent", command: "create", startedAt: now }),
    ).toThrow();
  });

  it("holds exactly the tables the store is meant to hold", () => {
    const tableNames = migrations
      .flatMap((step) => step.statements)
      .flatMap((statement) => [...statement.matchAll(/CREATE TABLE `?(\w+)`?/g)])
      .map((match) => match[1]!)
      // A column that stops being `NOT NULL` is a table SQLite cannot alter, so it is rebuilt beside
      // itself and renamed over. `__new_x` is that scaffolding — it never outlives its own migration.
      .filter((name) => !name.startsWith("__new_"))
      .sort();

    expect(tableNames).toEqual([
      "carried_run",
      "desired_state",
      "fact_snapshot",
      "machine_image",
      "requirement_run",
      "run",
      "run_image",
      "run_step",
      "target",
    ]);
  });
});
