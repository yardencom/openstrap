import type { Shell } from "./Shell.js";

export type OperatingSystemName = "linux" | "darwin" | "windows";

export class UnsupportedOperatingSystemError extends Error {
  constructor(reported: string) {
    super(`openstrap does not know how to read facts from "${reported}"`);
    this.name = "UnsupportedOperatingSystemError";
  }
}

/**
 * Which operating system a target runs.
 *
 * This is the single axis along which collection varies. It is asked once and
 * handed to every collector, so no collector has to work it out again and none
 * of them can disagree about the answer.
 */
export class OperatingSystem {
  private constructor(
    readonly name: OperatingSystemName,
    readonly release: string,
  ) {}

  static async detect(shell: Shell): Promise<OperatingSystem> {
    const reported = (await shell.output("uname -s")) ?? "";
    const release = (await shell.output("uname -r")) ?? "";

    if (reported === "Linux") {
      return new OperatingSystem("linux", release);
    }

    if (reported === "Darwin") {
      return new OperatingSystem("darwin", release);
    }

    if (reported.startsWith("MINGW") || reported.startsWith("MSYS") || reported.startsWith("CYGWIN")) {
      return new OperatingSystem("windows", release);
    }

    throw new UnsupportedOperatingSystemError(reported || "unknown");
  }

  /** For tests and for callers that already know what they are talking to. */
  static named(name: OperatingSystemName, release = ""): OperatingSystem {
    return new OperatingSystem(name, release);
  }

  get family(): string {
    return this.name === "darwin" ? "macos" : this.name;
  }

  is(name: OperatingSystemName): boolean {
    return this.name === name;
  }

  /** Picks the variant written for this operating system. */
  select<TValue>(variants: Record<OperatingSystemName, TValue>): TValue {
    return variants[this.name];
  }
}
