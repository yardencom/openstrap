import { beforeAll, describe, expect, it } from "vitest";

import { LocalTransport } from "../../../Transport/index.js";
import type { ProcessFact } from "../Inventory.js";
import { OperatingSystem } from "../OperatingSystem.js";
import { Shell } from "../Shell.js";
import { ProcessInventory } from "./ProcessInventory.js";

describe("ProcessInventory", () => {
  const shell = new Shell(new LocalTransport().processes);
  let operatingSystem: OperatingSystem;
  let processes: Record<string, ProcessFact>;

  beforeAll(async () => {
    operatingSystem = await OperatingSystem.detect(shell);
    processes = await new ProcessInventory().collect(shell, operatingSystem);
  });

  it("answers under the processes section", () => {
    expect(new ProcessInventory().section).toBe("processes");
  });

  it("keys every process by its own pid", () => {
    const entries = Object.entries(processes);

    expect(entries.length).toBeGreaterThan(0);

    for (const [key, entry] of entries) {
      expect(key).toMatch(/^pid-\d+$/);
      expect(key).toBe(`pid-${entry.pid}`);
    }
  });

  it("reports the process asking the question", () => {
    const self = processes[`pid-${process.pid}`];

    expect(self).toBeDefined();
    expect(self!.pid).toBe(process.pid);
    expect(self!.command.length).toBeGreaterThan(0);
  });

  it("reads the parent of the process asking the question", () => {
    const self = processes[`pid-${process.pid}`]!;

    expect(self.ppid).toBe(process.ppid);
  });

  it("gives every process a numeric pid and a command", () => {
    for (const [key, entry] of Object.entries(processes)) {
      expect(entry.status, key).toBe("present");
      expect(Number.isInteger(entry.pid), key).toBe(true);
      expect(entry.pid, key).toBeGreaterThan(0);
      expect(typeof entry.command, key).toBe("string");
      expect(entry.command.trim(), key).not.toBe("");
    }
  });

  it("answers with a map that can be looked up by name, not a list", () => {
    expect(Array.isArray(processes)).toBe(false);
    expect(processes).toBeTypeOf("object");
    expect(processes).not.toHaveProperty("length");
    expect(processes).not.toHaveProperty("0");
    expect(Object.keys(processes)).toContain(`pid-${process.pid}`);
    expect(Object.keys(processes).length).toBe(new Set(Object.values(processes).map((entry) => entry.pid)).size);
  });

  it("finds the process the kernel started first on a posix target", () => {
    if (operatingSystem.is("windows")) {
      return;
    }

    expect(processes["pid-1"]).toBeDefined();
    expect(processes["pid-1"]!.pid).toBe(1);
  });

  it("reads the process table on every call rather than once at construction", async () => {
    const inventory = new ProcessInventory();
    const first = await inventory.collect(shell, operatingSystem);
    const second = await inventory.collect(shell, operatingSystem);

    expect(second).not.toBe(first);
    expect(first[`pid-${process.pid}`]).toBeDefined();
    expect(second[`pid-${process.pid}`]).toBeDefined();
  });
});
