import type { MachineAccess, OpenStrapRuntime } from "../../Plugin/index.js";
import { KeychainSecretStore } from "../../Secrets/index.js";
import type { SqliteStateStore } from "../../StateStore/index.js";

export class UnknownMachineError extends Error {
  constructor(target: string) {
    super(`openstrap has no record of a machine for target "${target}". Create it first with: openstrap create vm ${target}`);
    this.name = "UnknownMachineError";
  }
}

export class MachineNotRunningError extends Error {
  constructor(target: string, status: string) {
    super(`Machine "${target}" is ${status}. Start it before connecting.`);
    this.name = "MachineNotRunningError";
  }
}

export type ConnectRequest = {
  target: string;
  runtime: OpenStrapRuntime;
  store: SqliteStateStore;
};

export type Connection = {
  access: MachineAccess;
  run(command: string): Promise<{ exitCode: number | null; stdout: string; stderr: string }>;
  close(): Promise<void>;
};

/**
 * Opens a session to a target, hiding how it is reached.
 *
 * Where the machine listens is asked of the provider rather than remembered:
 * a forwarded port can be reassigned and an address can change, and a stored
 * endpoint would be a second truth that drifts from the first.
 */
export class ConnectToTarget {
  constructor(private readonly secrets = new KeychainSecretStore()) {}

  async execute(request: ConnectRequest): Promise<Connection> {
    const resource = request.store.readProviderResource(request.target);
    const recorded = request.store.readTarget(request.target);

    if (!resource || !recorded) {
      throw new UnknownMachineError(request.target);
    }

    const provider = request.runtime.providers.require(resource.provider);
    const handle = { id: resource.resourceId, name: request.target };
    const state = await provider.inspect(handle);

    if (state.status !== "running") {
      throw new MachineNotRunningError(request.target, state.status);
    }

    const access = await provider.access(handle);
    const connector = request.runtime.transports.require(access.transport);
    const identity = request.store.readSecretReference(request.target, "ssh-identity");

    const connection = await connector.connect({
      target: request.target,
      endpoint: access.endpoint,
      identity: identity ? { store: identity.store, name: identity.name } : undefined,
      reveal: (reference) => this.secrets.read(reference),
    });

    return {
      access,
      run: (command) => connection.processes.capture({
        command: "sh",
        args: ["-c", command],
        cwd: ".",
      }),
      close: () => connection.close(),
    };
  }
}
