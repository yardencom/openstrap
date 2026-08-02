import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { CapturedSystemCommand, ProcessOutput, Transport } from "@openstrap/plugin-contract";
import { RemoteOpenStrap, type RemoteCollectRequest } from "./RemoteOpenStrap.js";
import { RemoteOpenStrapError } from "./errors/RemoteOpenStrapError.js";

const request: RemoteCollectRequest = {
  target: { name: "ubuntu-vm", scope: "guest", type: "vm" },
  requirements: [{ id: "home-exists", paths: { home: { status: "present" } } }],
  channel: { type: "ssh", authMethods: ["publickey"] },
};

/** What openstrap on the target prints: one snapshot, as JSON. */
const snapshot = {
  id: "snap_ubuntu-vm_20260608T100000000Z",
  schemaVersion: "facts.v1",
  scope: "guest",
  target: { type: "vm", id: "ubuntu-vm" },
  facts: { arch: "arm64" },
  reading: { takenAt: "2026-06-08T10:00:00.000Z", status: "success" },
};

/** What openstrap recorded the target to be when it created it. */
const linuxArm64 = { platform: "linux", architecture: "arm64" };

let built: string;

beforeAll(() => {
  built = mkdtempSync(join(tmpdir(), "openstrap-remote-"));
  writeFileSync(join(built, "openstrap-linux-arm64"), Buffer.from("openstrap"));
  writeFileSync(join(built, "openstrap-linux-arm64.sha256"), createHash("sha256").update("openstrap").digest("hex"));
  process.env.OPENSTRAP_BINARY_DIR = built;
});

afterAll(() => {
  delete process.env.OPENSTRAP_BINARY_DIR;
  rmSync(built, { recursive: true, force: true });
});

describe("openstrap on the target", () => {
  it("hands back the snapshot openstrap took over there", async () => {
    const target = fakeTarget({ answer: answering(snapshot) });

    const taken = await new RemoteOpenStrap(target.api, linuxArm64).collect(request);

    // Read back into the types a snapshot is made of, not handed on as the text it arrived as.
    expect(String(taken.id)).toBe(snapshot.id);
    expect(String(taken.reading.takenAt)).toBe(snapshot.reading.takenAt);
    expect(taken.facts.status()).toBe("success");
    expect(taken.facts.arch).toBe("arm64");

    // Named by the caller and stamped with the channel the caller opened: openstrap over there read
    // `host`, because from where it stood that is what the machine is, and it has no view of the
    // connection into it.
    expect(taken.target).toEqual({ id: "ubuntu-vm", type: "vm", displayName: undefined });
    expect(taken.scope).toBe("guest");
    expect(taken.facts.transports).toEqual({
      ssh: { status: "present", type: "ssh", ready: true, authMethods: ["publickey"] },
    });
  });

  it("asks the openstrap it delivered for facts, and leaves a blueprint where it will look", async () => {
    const target = fakeTarget({ answer: answering(snapshot) });

    await new RemoteOpenStrap(target.api, linuxArm64).collect(request);

    const [command] = target.captured;

    expect(command!.command).toContain("/tmp/openstrap/openstrap-");
    // `host` because openstrap over there reads the machine it is on; which machine that is to the
    // No flag carries the declaration any more: the machine is read the same way it would be read by
    // a person standing in a directory with a blueprint in it, and this writes that blueprint.
    expect(command!.args).toEqual(["facts", "collect", "host", "--json"]);
    expect(command!.cwd).toBe("/tmp/openstrap");
    expect(JSON.parse(target.written.get("/tmp/openstrap/openstrap.yaml")!)).toEqual({
      targets: { host: { requirements: request.requirements } },
    });
    // Nothing on the command line a shell could reinterpret on the way: the declaration is a file
    // now, and files do not go through argument parsing.
    expect(command!.args.every((argument) => !/["' \n]/.test(argument))).toBe(true);
  });

  it("treats an openstrap that failed as a machine it did not read", async () => {
    const target = fakeTarget({ answer: { exitCode: 1, stdout: "", stderr: "cannot read /proc" } });

    await expect(new RemoteOpenStrap(target.api, linuxArm64).collect(request)).rejects.toThrow(RemoteOpenStrapError);
    await expect(new RemoteOpenStrap(target.api, linuxArm64).collect(request)).rejects.toThrow(/cannot read \/proc/);
  });

  it("refuses an answer that is not a snapshot, rather than reporting a machine with nothing on it", async () => {
    const noise = fakeTarget({ answer: { exitCode: 0, stdout: "Welcome to Ubuntu\n", stderr: "" } });
    const list = fakeTarget({ answer: { exitCode: 0, stdout: "[]", stderr: "" } });

    await expect(new RemoteOpenStrap(noise.api, linuxArm64).collect(request)).rejects.toThrow(/not JSON/);
    await expect(new RemoteOpenStrap(list.api, linuxArm64).collect(request)).rejects.toThrow(/Not a snapshot/);
  });

  it("refuses a snapshot in a shape it does not read", async () => {
    const target = fakeTarget({ answer: answering({ ...snapshot, schemaVersion: "facts.v2" }) });

    await expect(new RemoteOpenStrap(target.api, linuxArm64).collect(request)).rejects.toThrow(/facts\.v2/);
  });

  it("reads nothing off the target to choose a build, because it was told what it is", async () => {
    const target = fakeTarget({ answer: answering(snapshot) });

    await new RemoteOpenStrap(target.api, linuxArm64).collect(request);

    expect(target.read).toEqual([]);
  });
});

function answering(payload: unknown): ProcessOutput {
  return { exitCode: 0, stdout: JSON.stringify(payload), stderr: "" };
}

function fakeTarget(behaviour: { answer: ProcessOutput }) {
  const captured: CapturedSystemCommand[] = [];
  const read: string[] = [];
  const written = new Map<string, string>();

  return {
    captured,
    read,
    written,
    api: {
      fileSystem: {
        joinPath: (...parts: string[]) => parts.join("/"),
        writeTextFile: async (path: string, content: string) => {
          written.set(path, content);
        },
        removePath: async (path: string) => {
          written.delete(path);
        },
        readTextFile: async (path: string) => written.get(path) ?? null,
        readFile: async (path: string) => {
          read.push(path);
          return elfHeader();
        },
        executable: async () => true,
        createDirectory: async () => {},
        writeFile: async () => {},
      },
      processes: {
        capture: async (command: CapturedSystemCommand) => {
          captured.push(command);
          return behaviour.answer;
        },
      },
      network: {},
    } as unknown as Transport,
  };
}

/** A 64-bit little-endian aarch64 ELF header, which is what a linux target answers with. */
function elfHeader(): Buffer {
  const header = Buffer.alloc(64);

  header.write("\x7fELF", 0, "binary");
  header.writeUInt8(2, 4);
  header.writeUInt8(1, 5);
  header.writeUInt16LE(0xb7, 18);

  return header;
}
