import { connect } from "node:net";

import type { BlueprintTarget } from "../../../Modules/Blueprint/index.js";
import type { MachineAccess, OpenStrapRuntime, TransportConnection } from "../../../Plugin/index.js";
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
  /** The key itself, where a server issued it. Absent means the connector has its own. */
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
    const deadline = Date.now() + (request.timeoutMs ?? 300_000);

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.read(connector, request);
      } catch (error) {
        if (!VerifyMachine.connectionWasLost(error) || Date.now() + VerifyMachine.pauseMs > deadline) {
          throw error;
        }

        await this.pause(VerifyMachine.pauseMs);
      }
    }
  }

  /**
   * A machine that has just booted is still settling: cloud-init may restart sshd under the first
   * connection. That is not a failed machine, so a connection lost is tried again until the deadline.
   */
  private static readonly pauseMs = 3_000;

  constructor(private readonly pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {}

  private static connectionWasLost(error: unknown): boolean {
    const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);

    return /connection (was )?(lost|closed|reset)|ECONNRESET|ECONNREFUSED|EPIPE|before handshake|SSHConnectionLostError/i.test(message);
  }

  private async read(
    connector: { connect(request: { target: string; endpoint: MachineAccess["endpoint"]; privateKey?: string }): Promise<TransportConnection> },
    request: VerifyRequest,
  ): Promise<VerifyResult> {
    const connection = await connector.connect({
      target: request.target.name,
      endpoint: request.access.endpoint,
      ...(request.privateKey === undefined ? {} : { privateKey: request.privateKey }),
    });

    try {
      const machine = request.platform;

      if (machine === undefined) {
        throw new UnknownMachinePlatformError(request.target.name);
      }

      const snapshot = await new RemoteOpenStrap(connection, machine).collect({
        target: request.machine,
        requirements: request.target.requirements,
        channel: { type: request.access.transport, authMethods: connection.authMethods },
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
