import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RunLock } from "../RunLock.js";
import { RunLockedError } from "../RunLockedError.js";

describe("Run lock", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "openstrap-lock-"));
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  it("lets one operation through and turns the second away", () => {
    const lock = new RunLock(directory);

    lock.acquire("ubuntu-vm", "create");

    expect(() => lock.acquire("ubuntu-vm", "connect")).toThrow(RunLockedError);
  });

  it("names the operation that is already holding the lock", () => {
    const lock = new RunLock(directory);

    lock.acquire("ubuntu-vm", "create");

    expect(() => lock.acquire("ubuntu-vm", "connect")).toThrow(/create started at/);
  });

  it("does not hold operations on other subjects", () => {
    const lock = new RunLock(directory);

    lock.acquire("ubuntu-vm", "create");

    expect(() => lock.acquire("other-vm", "create")).not.toThrow();
  });

  it("lets the subject be locked again once released", () => {
    const lock = new RunLock(directory);

    lock.acquire("ubuntu-vm", "create");
    lock.release("ubuntu-vm");

    expect(() => lock.acquire("ubuntu-vm", "create")).not.toThrow();
  });

  it("reclaims a lock left behind by a process that died", () => {
    const abandoned = new RunLock(directory);
    abandoned.acquire("ubuntu-vm", "create");

    const afterCrash = new RunLock(directory, { processRunning: () => false });

    expect(() => afterCrash.acquire("ubuntu-vm", "create")).not.toThrow();
  });

  it("keeps a lock whose owner is still alive", () => {
    const lock = new RunLock(directory, { processRunning: () => true });
    lock.acquire("ubuntu-vm", "create");

    expect(() => lock.acquire("ubuntu-vm", "create")).toThrow(RunLockedError);
  });

  it("releases the lock even when the operation fails", async () => {
    const lock = new RunLock(directory);

    await expect(lock.during("ubuntu-vm", "create", async () => {
      throw new Error("create failed halfway");
    })).rejects.toThrow("create failed halfway");

    expect(() => lock.acquire("ubuntu-vm", "create")).not.toThrow();
  });

  it("returns what the guarded operation returned", async () => {
    const lock = new RunLock(directory);

    expect(await lock.during("ubuntu-vm", "create", async () => "machine-1")).toBe("machine-1");
  });

  it("does not let a subject name escape the lock directory", () => {
    const lock = new RunLock(directory);

    lock.acquire("../escaped", "create");

    expect(() => lock.acquire("../escaped", "create")).toThrow(RunLockedError);
  });
});
