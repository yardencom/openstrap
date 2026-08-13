import { beforeEach, describe, expect, it } from "vitest";

import { CarryLocalRuns } from "../application/CarryLocalRuns.js";
import { OpenStrapServer } from "../../Server/index.js";
import { SqliteStateStore } from "../../StateStore/index.js";

const host = { id: "mac-probe", platform: "darwin", architecture: "arm64" };
const at = "2026-08-11T10:00:00.000Z";
const carriedAt = new Date("2026-08-11T11:00:00.000Z");

let store: SqliteStateStore;

beforeEach(() => {
  store = new SqliteStateStore(":memory:");
});

/** A server that answers every call and remembers what it was told. */
const found = async (_provider: string, target: string) => `RES-${target}`;
const gone = async () => null;

function serverListening(answers: { openFails?: number } = {}) {
  const asked: Array<{ path: string; body: unknown }> = [];
  let opens = 0;

  const send: typeof globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    asked.push({ path, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });

    if (path === "/v1/runs") {
      opens += 1;

      if (opens <= (answers.openFails ?? 0)) {
        return new Response(JSON.stringify({ message: "being worked on right now by somebody" }), { status: 409 });
      }

      return new Response(JSON.stringify({ runId: `server_run_${opens}` }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(null, { status: 204 });
  };

  return { asked, server: new OpenStrapServer({ url: "https://o.example", token: "t", fetch: send }) };
}

/** A machine made here with nothing shared, left exactly as `create` leaves one. */
function madeHere(name: string, options: { snapshot?: boolean; target?: boolean } = {}): string {
  const runId = `run_${name}_local`;

  if (options.target !== false) {
    store.saveTarget({ name, scope: "guest", type: "vm", provider: "utm", transport: "ssh" }, at);
    store.saveDesiredState(name, { name, provider: "utm", image: "ubuntu:24.04", requirements: [] }, at);
  } else {
    // A run needs a target row to exist at all; this one is left without the blueprint beside it.
    store.saveTarget({ name, scope: "guest", type: "vm", provider: "utm", transport: "ssh" }, at);
  }

  store.startRun({ id: runId, target: name, command: "create", startedAt: at });
  store.recordStep({ runId, ordinal: 1, name: "create machine", status: "succeeded", startedAt: at, finishedAt: at });

  if (options.snapshot) {
    store.saveFactSnapshot({
      id: `snap_${name}`, target: name, runId, schemaVersion: "facts.v1", capturedAt: at,
      data: { os: { name: "ubuntu" } },
    });
  }

  store.finishRun(runId, "succeeded", at);

  return runId;
}

describe("What happened here while no server was listening", () => {
  it("is told with the same three calls a run makes as it happens", async () => {
    madeHere("ubuntu-vm", { snapshot: true });
    const listening = serverListening();

    const outcome = await new CarryLocalRuns(store, listening.server, host, found).all(carriedAt);

    expect(outcome).toEqual({ carried: 1, failures: [] });
    expect(listening.asked.map((call) => call.path)).toEqual([
      "/v1/runs",
      "/v1/runs/server_run_1/resource",
      "/v1/runs/server_run_1/finish",
    ]);
  });

  it("carries the pin it was made from, so the organization runs the same bytes", async () => {
    madeHere("ubuntu-vm");
    store.saveMachineImage("ubuntu-vm", {
      reference: "ubuntu:24.04",
      url: "https://images.example/noble-arm64.img",
      sha256: "a".repeat(64),
      platform: "linux", architecture: "arm64", format: "qcow2", boot: "uefi",
    }, at);
    const listening = serverListening();

    await new CarryLocalRuns(store, listening.server, host, found).all(carriedAt);

    expect(listening.asked[0]!.body).toMatchObject({
      proposedImage: { sha256: "a".repeat(64), platform: "linux", architecture: "arm64" },
    });
  });

  it("carries what kind of machine it is, which the blueprint never said", async () => {
    madeHere("ubuntu-vm");
    const listening = serverListening();

    await new CarryLocalRuns(store, listening.server, host, found).all(carriedAt);

    expect(listening.asked[0]!.body).toMatchObject({
      target: { name: "ubuntu-vm", scope: "guest", type: "vm", transport: "ssh", provider: "utm" },
    });
  });

  it("carries the reading that was taken, where one was", async () => {
    madeHere("ubuntu-vm", { snapshot: true });
    const listening = serverListening();

    await new CarryLocalRuns(store, listening.server, host, found).all(carriedAt);

    expect(listening.asked[2]!.body).toMatchObject({
      status: "succeeded",
      snapshot: { id: "snap_ubuntu-vm", schemaVersion: "facts.v1" },
    });
  });

  it("goes once, because a run told twice is two machines in a history that had one", async () => {
    madeHere("ubuntu-vm");
    const listening = serverListening();
    const carry = () => new CarryLocalRuns(store, listening.server, host, found).all(carriedAt);

    await carry();

    await expect(carry()).resolves.toEqual({ carried: 0, failures: [] });
    expect(store.runsToCarry()).toEqual([]);
  });

  it("says nothing about a machine the provider no longer has", async () => {
    madeHere("ubuntu-vm");
    const listening = serverListening();

    // The run still goes: it happened, and the machine not lasting is part of the history rather
    // than a reason to lose it.
    await new CarryLocalRuns(store, listening.server, host, gone).all(carriedAt);

    expect(listening.asked.map((call) => call.path)).toEqual(["/v1/runs", "/v1/runs/server_run_1/finish"]);
  });

  it("leaves a run the server refused, and says why rather than swallowing it", async () => {
    madeHere("ubuntu-vm");
    const listening = serverListening({ openFails: 1 });

    const outcome = await new CarryLocalRuns(store, listening.server, host, found).all(carriedAt);

    expect(outcome.carried).toBe(0);
    expect(outcome.failures[0]).toMatch(/being worked on right now/);
    // Still here, so the next command tries again rather than losing it.
    expect(store.runsToCarry()).toHaveLength(1);
  });

  it("leaves a run whose blueprint was never written down, because nothing can be opened from it", async () => {
    madeHere("ubuntu-vm", { target: false });
    const listening = serverListening();

    const outcome = await new CarryLocalRuns(store, listening.server, host, found).all(carriedAt);

    expect(outcome.carried).toBe(0);
    expect(outcome.failures[0]).toMatch(/nothing was recorded about what "ubuntu-vm" is/);
    expect(listening.asked).toEqual([]);
  });

  it("does not carry a run that is still going, because it has no outcome to report", async () => {
    store.saveTarget({ name: "ubuntu-vm", scope: "guest", type: "vm", provider: "utm", transport: "ssh" }, at);
    store.saveDesiredState("ubuntu-vm", { name: "ubuntu-vm", requirements: [] }, at);
    store.startRun({ id: "run_open", target: "ubuntu-vm", command: "create", startedAt: at });
    const listening = serverListening();

    const outcome = await new CarryLocalRuns(store, listening.server, host, found).all(carriedAt);

    expect(outcome.carried).toBe(0);
    expect(listening.asked).toEqual([]);
  });

  it("carries the oldest first, so a history arrives in the order it happened", async () => {
    madeHere("first-vm");
    store.startRun({ id: "run_second", target: "first-vm", command: "converge", startedAt: "2026-08-11T12:00:00.000Z" });
    store.finishRun("run_second", "succeeded", "2026-08-11T12:01:00.000Z");
    const listening = serverListening();

    await new CarryLocalRuns(store, listening.server, host, found).all(carriedAt);

    expect(listening.asked.filter((call) => call.path === "/v1/runs")).toHaveLength(2);
  });
});
