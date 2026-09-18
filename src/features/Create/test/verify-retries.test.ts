import { createServer, type AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VerifyMachine } from "../application/VerifyMachine.js";
import type { OpenStrapRuntime, TransportConnection } from "../../../Plugin/index.js";
import type { BlueprintTarget } from "../../../Modules/Blueprint/index.js";

let port: number;
let answering: ReturnType<typeof createServer>;

beforeEach(async () => {
  answering = createServer((socket) => socket.write("SSH-2.0-fake\r\n"));
  await new Promise<void>((resolve) => answering.listen(0, "127.0.0.1", resolve));
  port = (answering.address() as AddressInfo).port;
});

afterEach(async () => {
  await new Promise<void>((resolve) => answering.close(() => resolve()));
});

function verifying(connects: Array<() => Promise<TransportConnection>>) {
  const attempts: number[] = [];
  const runtime = {
    transports: {
      require: () => ({
        connect: async () => {
          attempts.push(Date.now());
          const next = connects.shift();
          if (!next) throw new Error("no more connections scripted");
          return next();
        },
      }),
    },
  } as unknown as OpenStrapRuntime;

  const execute = () => new VerifyMachine(async () => {}).execute({
    target: { name: "shop", requirements: [] } as unknown as BlueprintTarget,
    machine: { name: "shop", scope: "guest", type: "vm" },
    access: { transport: "ssh", endpoint: { host: "127.0.0.1", port, user: "openstrap" } },
    platform: { platform: "linux", architecture: "arm64" },
    runtime,
    timeoutMs: 30_000,
  });

  return { execute, attempts };
}

describe("Reading a machine that has just come up", () => {
  it("tries again when the connection is lost under it, which a machine still settling does", async () => {
    const lost = async () => { throw new Error("Connection lost before handshake"); };
    const reset = async () => { const error = new Error("read ECONNRESET"); (error as Error & { code: string }).code = "ECONNRESET"; throw error; };
    const broken = async () => { throw new Error("no such binary for linux-arm64"); };
    const { execute, attempts } = verifying([lost, reset, broken]);

    await expect(execute()).rejects.toThrow(/no such binary/);
    expect(attempts).toHaveLength(3);
  });

  it("does not try again for a failure that is not the connection's", async () => {
    const { execute, attempts } = verifying([async () => { throw new Error("no such binary for linux-arm64"); }]);

    await expect(execute()).rejects.toThrow(/no such binary/);
    expect(attempts).toHaveLength(1);
  });
});
