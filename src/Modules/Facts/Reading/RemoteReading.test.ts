import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { CapturedSystemCommand, ProcessOutput, Transport } from "../../../Transport/index.js";
import type { FactDeclaration } from "../Domain/FactDeclaration.js";
import { RemoteReading, RemoteReadingError } from "./RemoteReading.js";

let built: string;

beforeAll(() => {
  built = mkdtempSync(join(tmpdir(), "openstrap-remote-"));
  writeFileSync(join(built, "openstrap-facts-linux-arm64"), Buffer.from("agent"));
  writeFileSync(join(built, "openstrap-facts-linux-arm64.sha256"), createHash("sha256").update("agent").digest("hex"));
  process.env.OPENSTRAP_FACTS_AGENT_DIR = built;
});

afterAll(() => {
  delete process.env.OPENSTRAP_FACTS_AGENT_DIR;
  rmSync(built, { recursive: true, force: true });
});

describe("RemoteReading", () => {
  it("hands back what the agent on the target reported", async () => {
    const transport = fakeTarget({ answer: { exitCode: 0, stdout: '{"arch":"arm64"}', stderr: "" } });
    const data = await new RemoteReading(transport.api).read({ sections: ["arch"] });

    expect(data).toEqual({ arch: "arm64" });
  });

  it("runs the agent it delivered, with the declaration encoded as one argument", async () => {
    const transport = fakeTarget({ answer: { exitCode: 0, stdout: "{}", stderr: "" } });
    const declaration: FactDeclaration = { sections: ["paths"], paths: { home: { path: "$HOME" } } };

    await new RemoteReading(transport.api).read(declaration);

    const [command] = transport.captured;

    expect(command!.command).toContain("/tmp/openstrap/facts-agent-");
    expect(command!.args[0]).toBe("--declaration");
    expect(JSON.parse(Buffer.from(command!.args[1]!, "base64").toString("utf8"))).toEqual(declaration);
    expect(command!.args[1]).not.toContain('"');
  });

  it("treats a failed agent as a machine it did not read", async () => {
    const transport = fakeTarget({ answer: { exitCode: 1, stdout: "", stderr: "cannot read /proc" } });

    await expect(new RemoteReading(transport.api).read()).rejects.toThrow(RemoteReadingError);
    await expect(new RemoteReading(transport.api).read()).rejects.toThrow(/cannot read \/proc/);
  });

  it("refuses an answer that is not a set of fact sections", async () => {
    const noise = fakeTarget({ answer: { exitCode: 0, stdout: "Welcome to Ubuntu\n", stderr: "" } });
    const list = fakeTarget({ answer: { exitCode: 0, stdout: "[]", stderr: "" } });

    await expect(new RemoteReading(noise.api).read()).rejects.toThrow(/not JSON/);
    await expect(new RemoteReading(list.api).read()).rejects.toThrow(/not a set of fact sections/);
  });

  it("works out what the target is before choosing an agent for it", async () => {
    const transport = fakeTarget({ answer: { exitCode: 0, stdout: "{}", stderr: "" } });

    await new RemoteReading(transport.api).read();

    expect(transport.read).toEqual(["/bin/sh"]);
  });
});

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
