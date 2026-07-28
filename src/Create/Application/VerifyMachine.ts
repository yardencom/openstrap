import { connect } from "node:net";

import type { BlueprintTarget } from "../../Blueprint/index.js";
import { Facts } from "../../Facts/Facts.js";
import type { MachineAccess, OpenStrapRuntime, SecretReference } from "../../Plugin/index.js";
import { RequiredFacts, RequirementEvaluator, type RequirementRun } from "../../Requirements/index.js";
import { KeychainSecretStore } from "../../Secrets/index.js";
import type { SqliteStateStore } from "../../StateStore/index.js";

export type VerifyRequest = {
  target: BlueprintTarget;
  access: MachineAccess;
  identity?: SecretReference;
  runtime: OpenStrapRuntime;
  store: SqliteStateStore;
  runId: string;
  timeoutMs?: number;
};

export type VerifyResult = {
  requirementRun: RequirementRun;
  snapshotId: string;
};

/**
 * Confirms what the machine actually is, once it is up.
 *
 * The checks run against facts collected from the guest, so the milestone's
 * security promises are demonstrated rather than assumed.
 */
export class VerifyMachine {
  constructor(
    private readonly secrets = new KeychainSecretStore(),
    private readonly evaluator = new RequirementEvaluator(),
  ) {}

  async execute(request: VerifyRequest): Promise<VerifyResult> {
    const endpoint = request.access.endpoint;

    await waitForPort(endpoint.host, endpoint.port, request.timeoutMs ?? 300_000);

    const connector = request.runtime.transports.require(request.access.transport);
    const connection = await connector.connect({
      target: request.target.name,
      endpoint,
      identity: request.identity,
      reveal: (reference) => this.secrets.read(reference),
    });

    try {
      const facts = await new Facts(connection).collect({
        target: {
          name: request.target.name,
          scope: request.target.scope,
          type: request.target.type,
          displayName: request.target.displayName,
          transport: request.target.transport,
        },
        declare: new RequiredFacts({ requirements: request.target.requirements }).declaration,
      });
      const item = facts[0]!;

      request.store.saveFactSnapshot({
        id: item.snapshot.id,
        target: request.target.name,
        runId: request.runId,
        schemaVersion: item.snapshot.schemaVersion,
        capturedAt: item.run.finishedAt,
        data: item.snapshot.data,
      });

      return {
        snapshotId: item.snapshot.id,
        requirementRun: this.evaluator.evaluate({
          target: request.target,
          requirements: request.target.requirements,
          factCollection: facts,
          trigger: "create",
          profile: "local-vm",
          purpose: "verify",
        }),
      };
    } finally {
      await connection.close();
    }
  }
}

/**
 * Waits for a machine to start answering.
 *
 * Booting is a temporary state, so a refused connection is retried. Anything
 * the connection itself rejects afterwards is not retried: a wrong key stays
 * wrong however long you wait for it.
 */
function waitForPort(host: string, port: number, timeoutMs: number): Promise<void> {
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
