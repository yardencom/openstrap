import type { TransportConnection } from "@openstrap/plugin-contract";
import { ApiClient } from "./api/ApiClient.js";
import { Cluster } from "./cluster/Cluster.js";
import type { Kubeconfig } from "./cluster/Kubeconfig.js";
import { Manifests } from "./manifests/Manifests.js";
import { TunnelUnavailableError } from "./errors/TunnelUnavailableError.js";
import type { DeclaredService, Registry } from "#types/Services.js";
import type { KubernetesObject } from "#types/Kubernetes.js";

export type Reached = {
  api: ApiClient;
  close(): Promise<void>;
};

/** A cluster on a machine: put there, reached through the channel to the machine, and told what to run. */
export class Kubernetes {
  static cluster(connection: TransportConnection): Cluster {
    return new Cluster(connection);
  }

  static manifests(
    services: Readonly<Record<string, DeclaredService>>,
    registries: Readonly<Record<string, Registry>> = {},
    values: Readonly<Record<string, string>> = {},
    now: Date = new Date(),
  ): KubernetesObject[] {
    return new Manifests(services, registries, values, now).objects();
  }

  /** The API of a cluster that listens only on its own machine, carried through the channel to it. */
  static async reach(connection: TransportConnection, kubeconfig: Kubeconfig): Promise<Reached> {
    if (connection.tunnel === undefined) {
      throw new TunnelUnavailableError();
    }

    const there = new URL(kubeconfig.server);
    const tunnel = await connection.tunnel({ host: there.hostname, port: Number(there.port || 443) });

    return {
      api: new ApiClient(kubeconfig.withServer(`https://${tunnel.host}:${tunnel.port}`)),
      close: () => tunnel.close(),
    };
  }
}
