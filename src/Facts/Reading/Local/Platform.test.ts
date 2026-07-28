import { arch, platform as nodePlatform } from "node:os";

import { describe, expect, it } from "vitest";

import { Platform } from "./Platform.js";

describe("Platform", () => {
  it("reports the machine this process is running on", () => {
    const current = Platform.current();

    expect(current.name).toBe(nodePlatform() === "darwin" ? "macos" : nodePlatform());
    expect(current.architecture).toBe(arch());
  });

  it("gives one architecture one spelling", () => {
    expect(Platform.of("linux", "aarch64").architecture).toBe("arm64");
    expect(Platform.of("linux", "x86_64").architecture).toBe("x64");
    expect(Platform.of("linux", "amd64").architecture).toBe("x64");
  });

  it("keeps an architecture it does not know rather than guessing", () => {
    expect(Platform.of("linux", "riscv64").architecture).toBe("riscv64");
  });

  it("applies a declaration that names no platform everywhere", () => {
    expect(Platform.of("windows").matches(undefined)).toBe(true);
    expect(Platform.of("windows").matches([])).toBe(true);
  });

  it("applies a declaration to the platforms it names", () => {
    expect(Platform.of("linux").matches(["linux"])).toBe(true);
    expect(Platform.of("linux").matches(["macos", "windows"])).toBe(false);
  });

  it("counts linux and macos as posix, and windows as neither", () => {
    for (const family of ["posix", "unix"]) {
      expect(Platform.of("linux").matches([family])).toBe(true);
      expect(Platform.of("macos").matches([family])).toBe(true);
      expect(Platform.of("windows").matches([family])).toBe(false);
    }
  });

  it("picks the variant written for this platform", () => {
    const variants = { linux: "systemd", macos: "launchd", windows: "scm" };

    expect(Platform.of("macos").select(variants)).toBe("launchd");
    expect(Platform.of("linux").select(variants)).toBe("systemd");
  });
});
