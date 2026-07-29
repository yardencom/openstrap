/** `\x7fELF`, the first four bytes of every ELF file. */
const magic = 0x7f454c46;

/** Where ELF records the things this needs, counted from the start of the file. */
const offsets = { endianness: 5, machine: 18 } as const;

/** `e_machine`: the architecture an ELF file was built for. */
const machines: Record<number, string> = {
  0x03: "x86",
  0x28: "arm",
  0x3e: "x64",
  0xb7: "arm64",
};

/**
 * An executable in the format Linux uses, read for the machine it was built for.
 *
 * openstrap reads one of these off a target to know which of its own builds to send there. Only the
 * two fields that answer that are read; everything else an ELF file says is somebody else's business.
 */
export class ElfHeader {
  private constructor(private readonly bytes: Buffer) {}

  /** These bytes, if they are an ELF file. */
  static in(bytes: Buffer): ElfHeader | undefined {
    return bytes.length >= 20 && bytes.readUInt32BE(0) === magic ? new ElfHeader(bytes) : undefined;
  }

  readonly platform = "linux";

  /**
   * Read in the endianness the file declares rather than in this machine's, because the target is
   * not this machine — an arm64 host is perfectly capable of reaching a big-endian target.
   */
  get architecture(): string | undefined {
    const machine = this.bytes.readUInt8(offsets.endianness) === 1
      ? this.bytes.readUInt16LE(offsets.machine)
      : this.bytes.readUInt16BE(offsets.machine);

    return machines[machine];
  }
}
