import { UnsupportedPlatformError } from "../../errors/UnsupportedPlatformError.js";
import { arch, platform } from "node:os";

export type PlatformName = "linux" | "macos" | "windows";


/**
 * The machine a reading is running on.
 *
 * Asked once and handed to everything that reads a section, so no two sections
 * can disagree about what they are looking at. A declaration may name the
 * platforms it applies to — `ssh-agent` is a process on Unix and a service on
 * Windows — and this is what decides whether it applies here.
 */
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

  /**
   * Whether a declaration written for particular platforms applies here.
   *
   * A declaration that names no platform applies everywhere: not naming one is
   * how a caller says the question is universal.
   */
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

  /**
   * One spelling per architecture.
   *
   * `aarch64` and `arm64` are the same machine, and a requirement written
   * against either must not depend on which tool happened to answer.
   */
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
