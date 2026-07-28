import type { FileSystemAPI } from "../../../../Transport/index.js";

/** An executable every POSIX machine has, read for the header it carries. */
const probedExecutable = "/bin/sh";

const elfMagic = 0x7f454c46;
const machO64LittleEndian = 0xcffaedfe;
const machO64BigEndian = 0xfeedfacf;
const machOUniversal = 0xcafebabe;

/** `e_machine`, the architecture an ELF file was built for. */
const elfMachines: Record<number, string> = {
  0x03: "x86",
  0x28: "arm",
  0x3e: "x64",
  0xb7: "arm64",
};

/** `cputype`, the architecture a Mach-O file was built for. */
const machOCpuTypes: Record<number, string> = {
  0x01000007: "x64",
  0x0100000c: "arm64",
  0x00000007: "x86",
};

export class UnreadableTargetPlatformError extends Error {
  constructor(detail: string) {
    super(`openstrap could not tell what kind of machine the target is: ${detail}`);
    this.name = "UnreadableTargetPlatformError";
  }
}

/**
 * Which machine is on the other end of a transport.
 *
 * Needed before anything else, because the agent that reads the facts has to be
 * built for that machine. It is answered by reading the header of an executable
 * the target already has: an operating system and an architecture are exactly
 * what an executable format records, and reading a file is something a transport
 * can do without running anything.
 *
 * This is not a fact about the target and never reaches a snapshot. It is how
 * openstrap decides which binary to send.
 */
export class TargetPlatform {
  private constructor(
    readonly name: string,
    readonly architecture: string,
  ) {}

  static async detect(files: FileSystemAPI): Promise<TargetPlatform> {
    const header = await files.readFile(probedExecutable);

    if (header === null) {
      throw new UnreadableTargetPlatformError(`${probedExecutable} could not be read`);
    }

    if (header.length < 20) {
      throw new UnreadableTargetPlatformError(`${probedExecutable} is too short to carry a header`);
    }

    const magic = header.readUInt32BE(0);

    if (magic === elfMagic) {
      return new TargetPlatform("linux", TargetPlatform.elfArchitecture(header));
    }

    if (magic === machO64LittleEndian || magic === machO64BigEndian || magic === machOUniversal) {
      return new TargetPlatform("macos", TargetPlatform.machOArchitecture(header, magic));
    }

    throw new UnreadableTargetPlatformError(`${probedExecutable} is in an unknown executable format`);
  }

  /** For tests and for callers that already know what they are talking to. */
  static of(name: string, architecture: string): TargetPlatform {
    return new TargetPlatform(name, architecture);
  }

  get id(): string {
    return `${this.name}-${this.architecture}`;
  }

  /**
   * `e_machine` sits at offset 18, in the endianness the file declares at offset
   * 5. Both are read rather than assumed, because an arm64 host is perfectly
   * capable of reaching an x86 target.
   */
  private static elfArchitecture(header: Buffer): string {
    const littleEndian = header.readUInt8(5) === 1;
    const machine = littleEndian ? header.readUInt16LE(18) : header.readUInt16BE(18);
    const architecture = elfMachines[machine];

    if (architecture === undefined) {
      throw new UnreadableTargetPlatformError(`ELF machine 0x${machine.toString(16)} is not one openstrap builds for`);
    }

    return architecture;
  }

  /**
   * `cputype` sits at offset 4 of a Mach-O header, and at offset 8 of a universal
   * binary's first architecture entry.
   */
  private static machOArchitecture(header: Buffer, magic: number): string {
    const cpuType = magic === machOUniversal ? header.readUInt32BE(8) : header.readUInt32LE(4);
    const architecture = machOCpuTypes[cpuType];

    if (architecture === undefined) {
      throw new UnreadableTargetPlatformError(`Mach-O cputype 0x${cpuType.toString(16)} is not one openstrap builds for`);
    }

    return architecture;
  }
}
