import { createServer, type Server } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { NetworkFacts } from "./NetworkFacts.js";

const facts = new NetworkFacts();
let listening: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => listening ? listening.close(() => resolve()) : resolve());
  listening = undefined;
});

/** Something holding a port on this machine, so the reading has a true case to find. */
function holdAPort(): Promise<number> {
  return new Promise((resolve) => {
    listening = createServer().listen(0, "127.0.0.1", () => {
      resolve((listening!.address() as { port: number }).port);
    });
  });
}

describe("the ports of a machine", () => {
  it("is not read at all when nobody asked about the network", async () => {
    expect(await facts.network(undefined)).toBeUndefined();
  });

  it("lists what is being held without being told any name", async () => {
    const port = await holdAPort();
    const network = (await facts.network({}))!;

    expect(network.ports[`tcp/${port}`]).toMatchObject({ status: "present", state: "listening" });
    // Nobody asked about it, so nobody knocked. Absent rather than false: `false` would be a claim.
    expect(network.ports[`tcp/${port}`]!.reachable).toBeUndefined();
  });

  /**
   * Held and reachable are two questions, and this is why openstrap asks both.
   *
   * A container publishes a port with a firewall rule that rewrites the destination and claims nothing
   * on the machine. The socket table is empty for that port while a connection to it is answered — so
   * a blueprint that asked only whether it was `listening` called a working cluster broken.
   */
  describe("a port some requirement named", () => {
    it("is knocked on, and says so when it answers", async () => {
      const port = await holdAPort();
      const network = (await facts.network({ ports: { [`tcp/${port}`]: { state: "listening" } } }))!;

      expect(network.ports[`tcp/${port}`]).toMatchObject({
        status: "present",
        state: "listening",
        reachable: true,
      });
    });

    it("says it does not answer, and is absent, when nothing is there", async () => {
      // Port 1 on loopback: privileged, and nothing on a developer machine or a vm holds it.
      const network = (await facts.network({ ports: { "tcp/1": { state: "listening" } } }))!;

      expect(network.ports["tcp/1"]).toMatchObject({ status: "absent", reachable: false, port: 1 });
    });

    it("is not knocked on over udp, where a connection means nothing", async () => {
      const network = (await facts.network({ ports: { "udp/53": { state: "listening" } } }))!;

      expect(network.ports["udp/53"]?.reachable).toBeUndefined();
    });
  });
});
