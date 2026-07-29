import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { CapturedSystemCommand, ProcessOutput, Transport } from "../Transport/index.js";
import type { FactOrder } from "../Modules/Facts/Facts.js";
import { RemoteOpenStrap } from "./RemoteOpenStrap.js";
import { RemoteOpenStrapError } from "./RemoteOpenStrapError.js";

const order: FactOrder = {
  target: { name: "ubuntu-vm", scope: "machine", type: "vm" },
  declare: { paths: { home: { path: "$HOME" } } },
  channel: { type: "ssh", authMethods: ["publickey"] },
};

/** What openstrap on the target prints: one snapshot, as JSON. */
const snapshot = {
  id: "snap_ubuntu-vm_20260608T100000000Z",
  schemaVersion: "facts.v1",
  scope: "machine",
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

    const taken = await new RemoteOpenStrap(target.api, linuxArm64).collect(order);

    // Read back into the types a snapshot is made of, not handed on as the text it arrived as.
    expect(String(taken.id)).toBe(snapshot.id);
    expect(String(taken.reading.takenAt)).toBe(snapshot.reading.takenAt);
    expect(taken.facts.status()).toBe("success");
    expect(JSON.parse(JSON.stringify(taken))).toEqual(snapshot);
  });

  it("asks the openstrap it delivered for facts, with the order as one argument", async () => {
    const target = fakeTarget({ answer: answering(snapshot) });

    await new RemoteOpenStrap(target.api, linuxArm64).collect(order);

    const [command] = target.captured;

    expect(command!.command).toContain("/tmp/openstrap/openstrap-");
    // `host` because openstrap over there reads the machine it is on; which machine that is to the
    // caller is in the order, and so is everything else it could not know about itself.
    expect(command!.args.slice(0, 5)).toEqual(["facts", "collect", "host", "--json", "--order"]);
    expect(JSON.parse(Buffer.from(command!.args[5]!, "base64").toString("utf8"))).toEqual(order);
    // One argument that no shell can reinterpret on the way.
    expect(command!.args[5]).not.toMatch(/["' \n]/);
  });

  it("treats an openstrap that failed as a machine it did not read", async () => {
    const target = fakeTarget({ answer: { exitCode: 1, stdout: "", stderr: "cannot read /proc" } });

    await expect(new RemoteOpenStrap(target.api, linuxArm64).collect(order)).rejects.toThrow(RemoteOpenStrapError);
    await expect(new RemoteOpenStrap(target.api, linuxArm64).collect(order)).rejects.toThrow(/cannot read \/proc/);
  });

  it("refuses an answer that is not a snapshot, rather than reporting a machine with nothing on it", async () => {
    const noise = fakeTarget({ answer: { exitCode: 0, stdout: "Welcome to Ubuntu\n", stderr: "" } });
    const list = fakeTarget({ answer: { exitCode: 0, stdout: "[]", stderr: "" } });

    await expect(new RemoteOpenStrap(noise.api, linuxArm64).collect(order)).rejects.toThrow(/not JSON/);
    await expect(new RemoteOpenStrap(list.api, linuxArm64).collect(order)).rejects.toThrow(/Not a snapshot/);
  });

  it("refuses a snapshot in a shape it does not read", async () => {
    const target = fakeTarget({ answer: answering({ ...snapshot, schemaVersion: "facts.v2" }) });

    await expect(new RemoteOpenStrap(target.api, linuxArm64).collect(order)).rejects.toThrow(/facts\.v2/);
  });

  it("refuses a snapshot whose name does not follow from what is in it", async () => {
    const renamed = { ...snapshot, id: "snap_something-else_20260608T100000000Z" };
    const target = fakeTarget({ answer: answering(renamed) });

    await expect(new RemoteOpenStrap(target.api, linuxArm64).collect(order)).rejects.toThrow(/is not what/);
  });

  it("reads nothing off the target to choose a build, because it was told what it is", async () => {
    const target = fakeTarget({ answer: answering(snapshot) });

    await new RemoteOpenStrap(target.api, linuxArm64).collect(order);

    expect(target.read).toEqual([]);
  });
});

function answering(payload: unknown): ProcessOutput {
  return { exitCode: 0, stdout: JSON.stringify(payload), stderr: "" };
}

function fakeTarget(behaviour: { answer: ProcessOutput }) {
  const captured: CapturedSystemCommand[] = [];
  const read: string[] = [];

  return {
    captured,
    read,
    api: {
      fileSystem: {
        joinPath: (...parts: string[]) => parts.join("/"),
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
