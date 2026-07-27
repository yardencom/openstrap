import { describe, expect, it } from "vitest";

import { LocalTransport, type ProcessAPI, type ProcessOutput } from "../../../Transport/index.js";
import { OperatingSystem, UnsupportedOperatingSystemError } from "../OperatingSystem.js";
import { Shell } from "../Shell.js";
import { SystemReadings, SystemReadingsError } from "./SystemReadings.js";

const shell = new Shell(new LocalTransport().processes);
const operatingSystem = await OperatingSystem.detect(shell);
const reading = await new SystemReadings().read(shell, operatingSystem);

/** A target that answers, but leaves most of what was asked unanswered. */
class HalfAnsweringProcesses implements ProcessAPI {
  async capture(): Promise<ProcessOutput> {
    return { exitCode: 0, stdout: "os_name=macos\nkernel=25.5.0\n", stderr: "" };
  }

  async processRunning(): Promise<boolean> {
    throw new Error("Reading facts does not watch processes");
  }

  async run(): Promise<void> {
    throw new Error("Reading facts does not run commands blind");
  }

  async startDetachedProcess(): Promise<number> {
    throw new Error("Reading facts does not start processes");
  }

  async stopDetachedProcess(): Promise<void> {
    throw new Error("Reading facts does not stop processes");
  }

  async succeeds(): Promise<boolean> {
    throw new Error("Reading facts does not test commands");
  }
}

describe("SystemReadings", () => {
  it("produces every scalar section and nothing else", () => {
    expect(Object.keys(reading).sort()).toEqual([
      "arch",
      "cpu",
      "memory",
      "network",
      "os",
      "packages",
      "privileges",
      "storage",
      "users",
    ]);
  });

  it("counts at least one processor the scheduler can run on", () => {
    expect(Number.isInteger(reading.cpu.cores)).toBe(true);
    expect(reading.cpu.cores).toBeGreaterThan(0);
    expect(reading.cpu.threads).toBeGreaterThanOrEqual(reading.cpu.cores);
    expect(reading.cpu.model).not.toBe("");
  });

  it("reports available memory as a part of what the machine has", () => {
    expect(Number.isInteger(reading.memory.totalBytes)).toBe(true);
    expect(Number.isInteger(reading.memory.availableBytes)).toBe(true);
    expect(reading.memory.availableBytes).toBeGreaterThanOrEqual(0);
    expect(reading.memory.totalBytes).toBeGreaterThan(reading.memory.availableBytes);
  });

  it("reports free space as a part of the root filesystem's capacity", () => {
    expect(Number.isInteger(reading.storage.totalBytes)).toBe(true);
    expect(Number.isInteger(reading.storage.availableBytes)).toBe(true);
    expect(reading.storage.availableBytes).toBeGreaterThanOrEqual(0);
    expect(reading.storage.totalBytes).toBeGreaterThan(reading.storage.availableBytes);
  });

  it("names the user the target itself reports", async () => {
    expect(reading.users.current.name).toBe(await shell.output("id -un"));
    expect(reading.users.current.uid).toBe(Number(await shell.output("id -u")));
    expect(reading.users.current.home.startsWith("/")).toBe(true);
  });

  it("answers with the machine's own name", async () => {
    expect(reading.network.hostname).toBe(await shell.output("uname -n"));
  });

  it("reports a family openstrap knows how to read", () => {
    expect(["macos", "linux", "windows"]).toContain(reading.os.family);
    expect(reading.os.name.length).toBeGreaterThan(0);
  });

  it("reports the operating system version rather than the kernel release", async () => {
    expect(reading.os.version).not.toBe("");
    expect(reading.os.kernel).not.toBe("");
    expect(reading.os.version).not.toBe(reading.os.kernel);
    expect(reading.os.kernel).toBe(await shell.output("uname -r"));
  });

  it("normalises the architecture the kernel reports", async () => {
    const machine = await shell.output("uname -m");
    const normalised: Record<string, string> = {
      aarch64: "arm64",
      amd64: "x64",
      arm64: "arm64",
      x86_64: "x64",
    };

    expect(reading.arch).toBe(normalised[machine ?? ""] ?? machine);
  });

  it("keys package managers by name rather than listing them", async () => {
    expect(Array.isArray(reading.packages.managers)).toBe(false);

    for (const [name, manager] of Object.entries(reading.packages.managers)) {
      expect(manager).toEqual({ status: "present" });
      // `apt` is the one manager whose executable is spelled `apt-get`.
      expect(await shell.succeeds(`command -v ${name} || command -v ${name}-get`)).toBe(true);
    }
  });

  it("describes privileges consistently with the user it read", () => {
    const root = reading.users.current.uid === 0;

    expect(reading.privileges.mode).toBe(root ? "root" : "sudo");
    expect(reading.privileges.admin.status).toBe(root ? "present" : "absent");
    expect(reading.privileges.sudo.passwordless).toBe(reading.privileges.sudo.status === "present");
  });

  it("fails loudly rather than turning an unanswered reading into an absent fact", async () => {
    const halfAnswering = new Shell(new HalfAnsweringProcesses());

    await expect(new SystemReadings().read(halfAnswering, operatingSystem)).rejects.toThrow(SystemReadingsError);
  });

  it("refuses to read an operating system it has no commands for", async () => {
    await expect(new SystemReadings().read(shell, OperatingSystem.named("windows")))
      .rejects.toThrow(UnsupportedOperatingSystemError);
  });
});
