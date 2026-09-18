import { UnsupportedPlatformError } from "../../errors/UnsupportedPlatformError.js";
import { arch, platform } from "node:os";

export type PlatformName = "linux" | "macos" | "windows";


/** The machine a reading is running on. */
export class Platform {
  private constructor(
    readonly name: PlatformName,
    readonly architecture: string,
  ) {}

  /** The machine this process is running on. */
  static current(): Platform {
    return Platform.of(Platform.named(platform()), arch());
  }

  /** For tests and for callers that already know what they are talking to. */
  static of(name: PlatformName, architecture = "arm64"): Platform {
    return new Platform(name, Platform.normalizedArchitecture(architecture));
  }

  /** Naming no platform applies everywhere: that is how a caller says the question is universal. */
  matches(platforms: readonly string[] | undefined): boolean {
    if (!platforms || platforms.length === 0) {
      return true;
    }

    if (platforms.includes(this.name)) {
      return true;
    }

    return this.name !== "windows" && (platforms.includes("posix") || platforms.includes("unix"));
  }

  is(name: PlatformName): boolean {
    return this.name === name;
  }

  /** Picks the variant written for this platform. */
  select<TValue>(variants: Record<PlatformName, TValue>): TValue {
    return variants[this.name];
  }

  private static named(reported: string): PlatformName {
    if (reported === "linux") {
      return "linux";
    }

    if (reported === "darwin") {
      return "macos";
    }

    if (reported === "win32") {
      return "windows";
    }

    throw new UnsupportedPlatformError(reported);
  }

  /** `aarch64` and `arm64` are the same machine, and a requirement must not depend on which answered. */
  private static normalizedArchitecture(reported: string): string {
    const names: Record<string, string> = {
      aarch64: "arm64",
      arm64: "arm64",
      amd64: "x64",
      x86_64: "x64",
      x64: "x64",
    };

    return names[reported] ?? reported;
  }
}
