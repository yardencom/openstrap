import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { BinaryFileWriteOptions, FileSystemAPI } from "../Transport/index.js";
import { OpenStrapBinary } from "./OpenStrapBinary.js";
import { MissingBinaryError } from "./MissingBinaryError.js";
import { TargetPlatform } from "./TargetPlatform.js";

const platform = TargetPlatform.of("linux", "arm64");
const contents = Buffer.from("an agent, for the purposes of this test");
const digest = createHash("sha256").update(contents).digest("hex");

/** A build is a binary plus the digest written beside it. */
function buildOpenStrap(directory: string, bytes: Buffer): void {
  const binary = join(directory, "openstrap-linux-arm64");

  writeFileSync(binary, bytes);
  writeFileSync(`${binary}.sha256`, createHash("sha256").update(bytes).digest("hex"));
}

let built: string;

beforeAll(() => {
  built = mkdtempSync(join(tmpdir(), "openstrap-remote-"));
  buildOpenStrap(built, contents);
});

afterAll(() => {
  rmSync(built, { recursive: true, force: true });
});

describe("OpenStrapBinary", () => {
  it("says how to get a build it does not have, rather than failing on the target", () => {
    expect(() => new OpenStrapBinary(TargetPlatform.of("linux", "x64"), built)).toThrow(MissingBinaryError);
    expect(() => new OpenStrapBinary(TargetPlatform.of("linux", "x64"), built)).toThrow(/npm run remote:build/);
  });

  it("delivers openstrap named after the digest of its own contents", async () => {
    const target = recordingFileSystem({ alreadyThere: false });
    const delivered = await new OpenStrapBinary(platform, built).deliverTo(target.api);

    expect(delivered).toBe(`/tmp/openstrap/openstrap-${digest.slice(0, 12)}`);
    expect(target.written).toEqual([{
      path: delivered,
      bytes: contents,
      options: { access: "executable" },
    }]);
    expect(target.directories).toEqual(["/tmp/openstrap"]);
  });

  it("does not send a build the target already has", async () => {
    const target = recordingFileSystem({ alreadyThere: true });
    const delivered = await new OpenStrapBinary(platform, built).deliverTo(target.api);

    expect(delivered).toContain(digest.slice(0, 12));
    expect(target.written).toEqual([]);
    expect(target.directories).toEqual([]);
  });

  it("deletes the build it supersedes, so a target does not collect every version it was sent", async () => {
    const target = recordingFileSystem({ alreadyThere: false, delivered: "/tmp/openstrap/openstrap-0000deadbeef" });
    const delivered = await new OpenStrapBinary(platform, built).deliverTo(target.api);

    expect(target.removed).toEqual(["/tmp/openstrap/openstrap-0000deadbeef"]);
    expect(target.records).toEqual([delivered]);
  });

  it("has nothing to delete on a target it has never read", async () => {
    const target = recordingFileSystem({ alreadyThere: false });

    await new OpenStrapBinary(platform, built).deliverTo(target.api);

    expect(target.removed).toEqual([]);
  });

  it("gives a changed build a name of its own, so the old one cannot answer for it", async () => {
    buildOpenStrap(built, Buffer.from("a different agent"));

    const target = recordingFileSystem({ alreadyThere: false });
    const delivered = await new OpenStrapBinary(platform, built).deliverTo(target.api);

    expect(delivered).not.toContain(digest.slice(0, 12));
  });
});

function recordingFileSystem(state: { alreadyThere: boolean; delivered?: string }) {
  const written: Array<{ path: string; bytes: Buffer; options?: BinaryFileWriteOptions }> = [];
  const directories: string[] = [];
  const removed: string[] = [];
  const records: string[] = [];

  return {
    written,
    directories,
    removed,
    records,
    api: {
      joinPath: (...parts: string[]) => parts.join("/"),
      executable: async () => state.alreadyThere,
      createDirectory: async (path: string) => {
        directories.push(path);
      },
      writeFile: async (path: string, bytes: Buffer, options?: BinaryFileWriteOptions) => {
        written.push({ path, bytes, options });
      },
      readTextFile: async () => state.delivered ?? null,
      removePath: async (path: string) => {
        removed.push(path);
      },
      writeTextFile: async (_path: string, content: string) => {
        records.push(content);
      },
    } as unknown as FileSystemAPI,
  };
}
