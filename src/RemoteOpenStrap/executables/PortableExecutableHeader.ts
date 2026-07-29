/** `MZ`, which every Windows executable still begins with, after the man who put it there. */
const magic = 0x4d5a;

/** `PE\0\0`, at the offset the `MZ` header points to. */
const signature = 0x50450000;

/** Where the parts this needs are: the pointer at a fixed place, the rest relative to what it says. */
const offsets = { signature: 0x3c, machine: 4 } as const;

/** `Machine`: the architecture a Windows executable was built for. */
const machines: Record<number, string> = {
  0x014c: "x86",
  0x8664: "x64",
  0xaa64: "arm64",
};

/**
 * An executable in the format Windows uses, read for the machine it was built for.
 *
 * Two headers rather than one: the file begins with a DOS header that says where the real one starts,
 * which is where the architecture is. Both are read, because a file that begins with `MZ` and points
 * at nothing is not a Windows executable.
 */
export class PortableExecutableHeader {
  private constructor(private readonly bytes: Buffer, private readonly start: number) {}

  /** These bytes, if they are a Windows executable. */
  static in(bytes: Buffer): PortableExecutableHeader | undefined {
    if (bytes.length < offsets.signature + 4 || bytes.readUInt16BE(0) !== magic) {
      return undefined;
    }

    const start = bytes.readUInt32LE(offsets.signature);

    return bytes.length >= start + offsets.machine + 2 && bytes.readUInt32BE(start) === signature
      ? new PortableExecutableHeader(bytes, start)
      : undefined;
  }

  readonly platform = "windows";

  get architecture(): string | undefined {
    return machines[this.bytes.readUInt16LE(this.start + offsets.machine)];
  }
}
