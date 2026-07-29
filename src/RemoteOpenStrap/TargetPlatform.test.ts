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

  it("reads windows and its architecture out of a PE header", async () => {
    const platform = await TargetPlatform.detect(answering(windowsHeader(0x8664)));

    expect(platform.id).toBe("windows-x64");
  });

  it("refuses to guess when there is no executable to read", async () => {
    await expect(TargetPlatform.detect(answering(null))).rejects.toThrow(UnreadableTargetPlatformError);
    await expect(TargetPlatform.detect(answering(null))).rejects.toThrow(/nothing to read its platform from/);
  });

  it("refuses to guess from a file too short to carry a header, or a format it does not know", async () => {
    await expect(TargetPlatform.detect(answering(Buffer.alloc(8)))).rejects.toThrow(/does not read/);
    await expect(TargetPlatform.detect(answering(Buffer.alloc(64)))).rejects.toThrow(/does not read/);
  });

  it("says which architecture it will not build for rather than picking one", async () => {
    await expect(TargetPlatform.detect(answering(elfHeader(0x2b)))).rejects.toThrow(/no build for/);
    await expect(TargetPlatform.detect(answering(machOHeader(0x0000000c)))).rejects.toThrow(/no build for/);
  });

  it("reads what a POSIX machine has, and what a Windows machine has instead", async () => {
    const posix: string[] = [];
    const windows: string[] = [];

    await TargetPlatform.detect(recording(posix, () => elfHeader(0xb7)));
    await TargetPlatform.detect(recording(windows, (path) =>
      path === "/bin/sh" ? null : windowsHeader(0xaa64)));

    expect(posix).toEqual(["/bin/sh"]);
    expect(windows).toEqual(["/bin/sh", "C:/Windows/System32/cmd.exe"]);
  });
});

function recording(paths: string[], answer: (path: string) => Buffer | null): FileSystemAPI {
  return {
    readFile: async (path: string) => {
      paths.push(path);
      return answer(path);
    },
  } as unknown as FileSystemAPI;
}

/** A Windows executable: the DOS header saying where the real one is, and the real one. */
function windowsHeader(machine: number): Buffer {
  const header = Buffer.alloc(256);
  const start = 0x80;

  header.write("MZ", 0, "binary");
  header.writeUInt32LE(start, 0x3c);
  header.write("PE\0\0", start, "binary");
  header.writeUInt16LE(machine, start + 4);

  return header;
}

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
