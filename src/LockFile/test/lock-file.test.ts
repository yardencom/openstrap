import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LockFile, type LockedTarget } from "../LockFile.js";

const ubuntu: LockedTarget = {
  image: {
    resolved: "https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-arm64.img",
    sha256: "2eaec7286c49fdea713dddabcf5012cafa7097a658e916acb48f4bc5fdc8e419",
    signature: "verified",
    arch: "arm64",
    format: "qcow2",
    boot: "uefi",
  },
  plugins: { "@openstrap/utm": "0.1.0" },
};

describe("Lock file", () => {
  let directory: string;
  let path: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "openstrap-lock-"));
    path = join(directory, "openstrap.lock.yaml");
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  it("reads as empty when there is no file yet", () => {
    expect(new LockFile(path).read()).toEqual({ targets: {} });
  });

  it("writes what a run resolved and reads it back", () => {
    const lock = new LockFile(path);

    lock.record("ubuntu-vm", ubuntu);

    expect(lock.read().targets["ubuntu-vm"]).toEqual(ubuntu);
  });

  it("says in the file itself that it is generated", () => {
    new LockFile(path).record("ubuntu-vm", ubuntu);

    expect(readFileSync(path, "utf8")).toContain("generated, not edited by hand");
  });

  it("keeps other targets when one is re-recorded", () => {
    const lock = new LockFile(path);

    lock.record("ubuntu-vm", ubuntu);
    lock.record("builder", ubuntu);
    lock.record("ubuntu-vm", { ...ubuntu, image: { ...ubuntu.image, sha256: "b".repeat(64) } });

    expect(Object.keys(lock.read().targets)).toEqual(["builder", "ubuntu-vm"]);
    expect(lock.read().targets["ubuntu-vm"]!.image.sha256).toBe("b".repeat(64));
    expect(lock.read().targets.builder).toEqual(ubuntu);
  });

  it("writes targets in a stable order, so the file does not churn in git", () => {
    new LockFile(path).record("zeta", ubuntu);
    new LockFile(path).record("alpha", ubuntu);
    const first = readFileSync(path, "utf8");

    rmSync(path);
    new LockFile(path).record("alpha", ubuntu);
    new LockFile(path).record("zeta", ubuntu);

    expect(readFileSync(path, "utf8")).toBe(first);
  });

  it("holds nothing that is true of one machine only", () => {
    new LockFile(path).record("ubuntu-vm", ubuntu);
    const written = readFileSync(path, "utf8");

    for (const machineLocal of ["hostPort", "host_port", "resourceId", "resource_id", "2222", "runId"]) {
      expect(written).not.toContain(machineLocal);
    }
  });

  it("survives a file that is not valid yaml rather than losing the run", () => {
    const lock = new LockFile(path);

    writeFileSync(path, "targets: [this is not: a map\n", "utf8");

    expect(lock.read()).toEqual({ targets: {} });
  });
});
