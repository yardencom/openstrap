import { Connect } from "#features/Connect/Connect.js";
import { Kubernetes, ServicesNotReadyError } from "../../Modules/Kubernetes/index.js";
import { RemoteOpenStrap } from "../../Modules/RemoteOpenStrap/RemoteOpenStrap.js";
import { UnknownMachinePlatformError } from "../../Modules/RemoteOpenStrap/errors/UnknownMachinePlatformError.js";
import { Requirements, type RequirementRun } from "../../Modules/Requirements/index.js";
import { ServiceSecrets } from "./application/ServiceSecrets.js";
import { ServicesNeedAMachineError } from "./errors/ServicesNeedAMachineError.js";
import type { BlueprintTarget } from "../../Modules/Blueprint/index.js";
import type { FactSnapshot } from "#types/FactSnapshot.js";
import type { OpenStrapRuntime, TransportConnection } from "../../Plugin/index.js";
import type { OpenStrapServer } from "../../Api/index.js";
import type { Store } from "../../Store/index.js";
import type { Target } from "#types/Target.js";

export { MissingSecretsError } from "./errors/MissingSecretsError.js";
export { NoSecretStoreError } from "./errors/NoSecretStoreError.js";
export { ServicesNeedAMachineError } from "./errors/ServicesNeedAMachineError.js";

export type DeployRequest = {
  target: BlueprintTarget;
  runtime: OpenStrapRuntime;
  store?: Store;
  server?: OpenStrapServer;
  now?: Date;
};

export type DeployStep = {
  name: string;
  status: "succeeded" | "skipped" | "failed";
  detail?: string;
  finishedAt: string;
};

export type DeployResult = {
  steps: DeployStep[];
  snapshot: FactSnapshot;
  requirementRun: RequirementRun;
};

/** `deploy` — a cluster on the machine and the declared services running in it, then the machine read to prove it. */
export class Deploy {
  private static readonly readyWithinMs = 300_000;
  private static readonly answerWithinMs = 90_000;

  async execute(request: DeployRequest): Promise<DeployResult> {
    const declared = request.target;

    if (declared.provider === undefined) {
      throw new ServicesNeedAMachineError(declared.name);
    }

    const values = await new ServiceSecrets(request.runtime.secretStores.soleIfAny()).valuesFor(declared);
    const steps: DeployStep[] = [];
    const done = (step: Omit<DeployStep, "finishedAt">) => steps.push({ ...step, finishedAt: new Date().toISOString() });
    const connection = await new Connect().execute({
      target: declared.name,
      runtime: request.runtime,
      store: request.store,
      server: request.server,
    });

    try {
      if (connection.machine === undefined) {
        throw new UnknownMachinePlatformError(declared.name);
      }

      const cluster = Kubernetes.cluster(connection.transport);

      if (await cluster.present()) {
        done({ name: "cluster", status: "skipped", detail: "k3s already running" });
      } else {
        await cluster.install();
        done({ name: "cluster", status: "succeeded", detail: "k3s installed" });
      }

      const reached = await Kubernetes.reach(connection.transport, await cluster.kubeconfig());

      try {
        const names = Object.keys(declared.services ?? {});

        for (const object of Kubernetes.manifests(declared.services ?? {}, declared.registries ?? {}, values, request.now)) {
          await reached.api.apply(object);
        }

        done({ name: "services", status: "succeeded", detail: names.join(", ") });
        done(await Deploy.readiness(reached.api.waitUntilReady(names, Deploy.readyWithinMs)));
      } finally {
        await reached.close();
      }

      await this.answering(connection.transport, Deploy.publicPorts(declared));

      const machine: Target = { name: declared.name, ...connection.kind, displayName: declared.displayName };
      const snapshot = await new RemoteOpenStrap(connection.transport, connection.machine).collect({
        target: machine,
        requirements: declared.requirements,
        channel: { type: connection.access.transport, authMethods: connection.transport.authMethods },
        now: request.now,
      });

      return {
        steps,
        snapshot,
        requirementRun: new Requirements(declared.requirements).checkedAgainst({
          target: machine,
          snapshots: [snapshot],
          trigger: "deploy",
          purpose: "deploy",
          now: request.now,
        }),
      };
    } finally {
      await connection.close();
    }
  }

  /**
   * A pod that is ready is not yet a port that answers: the cluster publishes the port on the machine
   * a moment later, and right after a reboot the moment is long. The reading that follows is the
   * proof, so it is given that moment rather than made to fail for reading too early.
   */
  private async answering(transport: TransportConnection, ports: readonly number[]): Promise<void> {
    const deadline = Date.now() + Deploy.answerWithinMs;

    for (const port of ports) {
      while (Date.now() < deadline) {
        const answers = await transport.processes.succeeds({
          command: "bash",
          args: ["-c", `exec 3<>/dev/tcp/127.0.0.1/${port}`],
          cwd: "/",
          stdio: "ignore",
        });

        if (answers) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
  }

  private static publicPorts(target: BlueprintTarget): number[] {
    return Object.values(target.services ?? {})
      .filter((service) => service.public === true && service.port !== undefined)
      .map((service) => service.port!);
  }

  /** Not ready is reported, not thrown: the reading that follows says the same thing in the requirements. */
  private static async readiness(waited: Promise<void>): Promise<Omit<DeployStep, "finishedAt">> {
    try {
      await waited;

      return { name: "ready", status: "succeeded" };
    } catch (error) {
      if (error instanceof ServicesNotReadyError) {
        return { name: "ready", status: "failed", detail: error.message };
      }

      throw error;
    }
  }
}
