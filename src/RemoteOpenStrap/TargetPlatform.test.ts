import { describe, expect, it } from "vitest";

import type { FileSystemAPI } from "../Transport/index.js";
import { TargetPlatform } from "./TargetPlatform.js";
import { UnreadableTargetPlatformError } from "./UnreadableTargetPlatformError.js";

describe("TargetPlatform", () => {
  it("reads linux and its architecture out of an ELF header", async () => {
    const platform = await TargetPlatform.detect(answering(elfHeader(0xb7)));

    expect(platform.name).toBe("linux");
    expect(platform.architecture).toBe("arm64");
    expect(platform.id).toBe("linux-arm64");
  });

  it("reads the architecture an ELF file was actually built for", async () => {
    expect((await TargetPlatform.detect(answering(elfHeader(0x3e)))).architecture).toBe("x64");
    expect((await TargetPlatform.detect(answering(elfHeader(0x03)))).architecture).toBe("x86");
  });

  it("reads a big-endian ELF header the way the file says to", async () => {
    const platform = await TargetPlatform.detect(answering(elfHeader(0xb7, { bigEndian: true })));

    expect(platform.id).toBe("linux-arm64");
  });

  it("reads macos and its architecture out of a Mach-O header", async () => {
    const platform = await TargetPlatform.detect(answering(machOHeader(0x0100000c)));

    expect(platform.id).toBe("macos-arm64");
  });

  it("reads the first architecture of a universal binary", async () => {
    const platform = await TargetPlatform.detect(answering(universalHeader(0x01000007)));

    expect(platform.id).toBe("macos-x64");
  });

  it("refuses to guess when the probe cannot be read", async () => {
    await expect(TargetPlatform.detect(answering(null))).rejects.toThrow(UnreadableTargetPlatformError);
  });

  it("refuses to guess from a file too short to carry a header", async () => {
    await expect(TargetPlatform.detect(answering(Buffer.alloc(8)))).rejects.toThrow(/too short/);
  });

  it("refuses to guess from a format it does not know", async () => {
    await expect(TargetPlatform.detect(answering(Buffer.alloc(64)))).rejects.toThrow(/unknown executable format/);
  });

  it("names the architecture it will not build for rather than picking one", async () => {
    await expect(TargetPlatform.detect(answering(elfHeader(0x2b)))).rejects.toThrow(/ELF machine 0x2b/);
    await expect(TargetPlatform.detect(answering(machOHeader(0x0000000c)))).rejects.toThrow(/cputype 0xc/);
  });

  it("reads the probe every POSIX machine has", async () => {
    const read: string[] = [];

    await TargetPlatform.detect({
      readFile: async (path: string) => {
        read.push(path);
        return elfHeader(0xb7);
      },
    } as unknown as FileSystemAPI);

    expect(read).toEqual(["/bin/sh"]);
  });
});

function answering(content: Buffer | null): FileSystemAPI {
  return { readFile: async () => content } as unknown as FileSystemAPI;
}

function elfHeader(machine: number, options: { bigEndian?: boolean } = {}): Buffer {
  const header = Buffer.alloc(64);

  header.write("\x7fELF", 0, "binary");
  header.writeUInt8(2, 4);
  header.writeUInt8(options.bigEndian ? 2 : 1, 5);

  if (options.bigEndian) {
    header.writeUInt16BE(machine, 18);
  } else {
    header.writeUInt16LE(machine, 18);
  }

  return header;
}

function machOHeader(cpuType: number): Buffer {
  const header = Buffer.alloc(64);

  header.writeUInt32BE(0xcffaedfe, 0);
  header.writeUInt32LE(cpuType, 4);

  return header;
}

function universalHeader(cpuType: number): Buffer {
  const header = Buffer.alloc(64);

  header.writeUInt32BE(0xcafebabe, 0);
  header.writeUInt32BE(1, 4);
  header.writeUInt32BE(cpuType, 8);

  return header;
}
