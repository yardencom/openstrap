import { connect } from "node:net";

import type { BlueprintTarget } from "../../../Modules/Blueprint/index.js";
import type { MachineAccess, OpenStrapRuntime, SecretReference } from "../../../Plugin/index.js";
import { Requirements, type RequirementRun } from "../../../Modules/Requirements/index.js";
import { RemoteOpenStrap } from "../../../Modules/RemoteOpenStrap/RemoteOpenStrap.js";
import type { FactSnapshot } from "#types/FactSnapshot.js";
import type { Target } from "#types/Target.js";
import { UnknownMachinePlatformError } from "../../../Modules/RemoteOpenStrap/errors/UnknownMachinePlatformError.js";
import type { MachinePlatform } from "#types/Machine.js";

export type VerifyRequest = {
  target: BlueprintTarget;
  machine: Target;
  access: MachineAccess;
  identity?: SecretReference;
  /** The key itself, where a server issued it and there is nothing to look up. */
  privateKey?: string;
  /** What a build of openstrap for this machine has to be built for, as the image it was made from says. */
  platform?: MachinePlatform;
  runtime: OpenStrapRuntime;
  timeoutMs?: number;
};

export type VerifyResult = {
  requirementRun: RequirementRun;
  /** What was read, so a caller can report the machine rather than the name of a reading of it. */
  snapshot: FactSnapshot;
};

/** Confirms what the machine actually is, once it is up. */
export class VerifyMachine {
  async execute(request: VerifyRequest): Promise<VerifyResult> {
    const endpoint = request.access.endpoint;

    await VerifyMachine.waitForPort(endpoint.host, endpoint.port, request.timeoutMs ?? 300_000);

    const connector = request.runtime.transports.require(request.access.transport);
    const connection = await connector.connect({
      target: request.target.name,
      endpoint,
      identity: request.identity,
      reveal: async (reference) => request.privateKey
        ?? await request.runtime.secretStores.require(reference.store).read(reference),
    });

    try {
      // Read by openstrap on the machine itself, delivered over this connection. The connection is
      // how it gets there and how it answers; it is not where any fact comes from.
      const machine = request.platform;

      if (machine === undefined) {
        throw new UnknownMachinePlatformError(request.target.name);
      }

      const snapshot = await new RemoteOpenStrap(
        connection,
        machine,
      ).collect({
        target: request.machine,
        requirements: request.target.requirements,
        channel: {
          // The channel this reading came back over, as whoever opened it reports — not what the
          // blueprint called it, and not a word put in by a loader that had never reached anything.
          type: request.access.transport,
          // What the connection reports it authenticated with, not what the blueprint called the
          // channel: a security requirement checked against openstrap's own configuration checks
          // nothing.
          authMethods: connection.authMethods,
        },
      });


      return {
        snapshot,
        requirementRun: new Requirements(request.target.requirements).checkedAgainst({
          target: request.machine,
          snapshots: [snapshot],
          trigger: "create",
          profile: "local-vm",
          purpose: "verify",
        }),
      };
    } finally {
      await connection.close();
    }
  }

  /** Waits for a machine to start answering. */
  private static waitForPort(host: string, port: number, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    return new Promise((resolve, reject) => {
      const attempt = (): void => {
        if (Date.now() > deadline) {
          reject(new Error(`${host}:${port} did not start answering within ${Math.round(timeoutMs / 1000)}s`));
          return;
        }

        const socket = connect({ host, port });
        const retry = (): void => {
          socket.destroy();
          setTimeout(attempt, 3000);
        };

        socket.setTimeout(5000);
        socket.once("data", () => {
          socket.destroy();
          resolve();
        });
        socket.once("error", retry);
        socket.once("timeout", retry);
      };

      attempt();
    });
  }
}
