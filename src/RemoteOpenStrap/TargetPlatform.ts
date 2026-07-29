import { ElfHeader } from "./executables/ElfHeader.js";
import { MachOHeader } from "./executables/MachOHeader.js";
import { PortableExecutableHeader } from "./executables/PortableExecutableHeader.js";
import { UnreadableTargetPlatformError } from "./UnreadableTargetPlatformError.js";
import type { FileSystemAPI } from "../Transport/index.js";

/**
 * Executables a machine is expected to already have, whichever machine it turns out to be.
 *
 * Read for their headers, in this order, until one of them is there. `/bin/sh` is required of every
 * POSIX machine; `cmd.exe` has been where it is since Windows NT.
 */
const probed = ["/bin/sh", "C:/Windows/System32/cmd.exe"] as const;

/**
 * Which machine is on the other end of a transport.
 *
 * Answered before anything else, because the openstrap that reads a machine has to be built for it,
 * and a build for one machine does not run on another.
 *
 * Answered by reading a program the target already has, rather than by running one: an operating
 * system and an architecture are exactly what an executable format records, in a number that means
 * the same everywhere. `uname` would answer in words that do not — `aarch64` on Linux is `arm64` on
 * macOS — and it is a program, which is the thing openstrap does not have there yet.
 *
 * This is not a fact about the target and never reaches a snapshot. It is how openstrap picks the
 * build to send, so the words here are the words its builds are named with: `linux-arm64`,
 * `macos-arm64`, `windows-x64`.
 */
export class TargetPlatform {
  private constructor(
    readonly name: string,
    readonly architecture: string,
  ) {}

  static async detect(files: FileSystemAPI): Promise<TargetPlatform> {
    for (const path of probed) {
      const bytes = await files.readFile(path);
      const header = bytes === null
        ? undefined
        : ElfHeader.in(bytes) ?? MachOHeader.in(bytes) ?? PortableExecutableHeader.in(bytes);

      if (bytes !== null && header === undefined) {
        throw new UnreadableTargetPlatformError(`${path} is in an executable format openstrap does not read`);
      }

      if (header !== undefined) {
        return TargetPlatform.reading(path, header);
      }
    }

    throw new UnreadableTargetPlatformError(
      `it has none of ${probed.join(", ")}, so openstrap has nothing to read its platform from`,
    );
  }

  /** For tests, and for callers that already know what they are talking to. */
  static of(name: string, architecture: string): TargetPlatform {
    return new TargetPlatform(name, architecture);
  }

  get id(): string {
    return `${this.name}-${this.architecture}`;
  }

  private static reading(path: string, header: { platform: string; architecture: string | undefined }): TargetPlatform {
    if (header.architecture === undefined) {
      throw new UnreadableTargetPlatformError(`${path} is built for a machine openstrap has no build for`);
    }

    return new TargetPlatform(header.platform, header.architecture);
  }
}
