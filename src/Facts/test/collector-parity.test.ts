import { describe, expect, it } from "vitest";

import { LocalTransport } from "../../Transport/index.js";
import { probesByOperatingSystem, toolProbes } from "../Collectors/OperatingSystems.js";
import { SystemCollector, UnsupportedOperatingSystemError } from "../Collectors/SystemCollector.js";
import { readings, script } from "../Collectors/Probe.js";

const sections = [
  "arch", "cpu", "env", "memory", "network", "os", "packages", "paths",
  "privileges", "processes", "runtimes", "services", "storage", "tools", "transports", "users",
];

describe("Fact collection is the same everywhere", () => {
  it("asks every operating system for exactly the same readings", () => {
    const keys = Object.values(probesByOperatingSystem).map(
      (probes) => probes.map((probe) => probe.key).sort(),
    );

    for (const set of keys) {
      expect(set).toEqual(keys[0]);
    }
  });

  it("asks about tools the same way whatever the operating system", () => {
    expect(toolProbes.map((probe) => probe.key)).toEqual(["tool_node", "tool_npm", "tool_python3", "tool_git"]);
  });

  it("produces every section from the host, over the local transport", async () => {
    const collected = await new SystemCollector(new LocalTransport()).collect();

    expect(Object.keys(collected).sort()).toEqual(sections);
  });

  it("reads the operating system version rather than the kernel version", async () => {
    const collected = await new SystemCollector(new LocalTransport()).collect() as {
      os: { version: string; kernel: string };
    };

    expect(collected.os.version).not.toBe(collected.os.kernel);
  });

  it("refuses a target whose operating system it does not know", async () => {
    const collector = new SystemCollector({
      fileSystem: {} as never,
      network: {} as never,
      processes: {
        capture: async () => ({ exitCode: 0, stdout: "Plan9\n", stderr: "" }),
      } as never,
    });

    await expect(collector.collect()).rejects.toThrow(UnsupportedOperatingSystemError);
  });

  it("fails loudly instead of reporting facts as absent when a target cannot be read", async () => {
    const collector = new SystemCollector({
      fileSystem: {} as never,
      network: {} as never,
      processes: {
        capture: async () => ({ exitCode: 255, stdout: "", stderr: "connection lost" }),
      } as never,
    });

    await expect(collector.collect()).rejects.toThrow(/connection lost/);
  });

  it("parses readings into values, numbers and flags", () => {
    const read = readings("cores=4\nsudo=yes\nempty=\nmodel=Apple M1 Pro");

    expect(read.number("cores")).toBe(4);
    expect(read.flag("sudo")).toBe(true);
    expect(read.flag("missing")).toBe(false);
    expect(read.present("empty")).toBe(false);
    expect(read.get("model")).toBe("Apple M1 Pro");
  });

  it("builds one script from many probes, so one round trip answers them all", () => {
    const built = script([{ key: "arch", command: "uname -m" }, { key: "user", command: "id -un" }]);

    expect(built.split(";")).toHaveLength(2);
    expect(built).toContain("arch");
    expect(built).toContain("uname -m");
  });
});
