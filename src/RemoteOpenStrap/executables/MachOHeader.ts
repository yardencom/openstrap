/** The first four bytes of a Mach-O file, in each of the shapes it comes in. */
const magic = {
  littleEndian64: 0xcffaedfe,
  bigEndian64: 0xfeedfacf,
  /** Several architectures in one file, each with its own header after this one. */
  universal: 0xcafebabe,
} as const;

/** Where `cputype` sits: in the header itself, or in a universal file's first entry. */
const offsets = { cpuType: 4, firstEntryCpuType: 8 } as const;

/** `cputype`: the architecture a Mach-O file was built for. */
const cpuTypes: Record<number, string> = {
  0x00000007: "x86",
  0x01000007: "x64",
  0x0100000c: "arm64",
};

/**
 * An executable in the format macOS uses, read for the machine it was built for.
 *
 * A universal file carries several architectures, and the first one is taken: openstrap needs a build
 * that runs there, and any architecture the target ships its own programs for is one that runs.
 */
export class MachOHeader {
  private constructor(private readonly bytes: Buffer, private readonly kind: number) {}

  /** These bytes, if they are a Mach-O file. */
  static in(bytes: Buffer): MachOHeader | undefined {
    if (bytes.length < 20) {
      return undefined;
    }

    const kind = bytes.readUInt32BE(0);

    return Object.values(magic).includes(kind as never) ? new MachOHeader(bytes, kind) : undefined;
  }

  readonly platform = "macos";

  get architecture(): string | undefined {
    return cpuTypes[this.kind === magic.universal
      ? this.bytes.readUInt32BE(offsets.firstEntryCpuType)
      : this.bytes.readUInt32LE(offsets.cpuType)];
  }
}
