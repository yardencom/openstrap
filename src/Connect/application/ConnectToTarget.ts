import { MachineNotRunningError } from "../errors/MachineNotRunningError.js";
import { UnknownMachineError } from "../errors/UnknownMachineError.js";
import type { MachineAccess, TransportConnection, OpenStrapRuntime } from "../../Plugin/index.js";
import { KeychainSecretStore } from "../../Secrets/index.js";
import type { SqliteStateStore } from "../../StateStore/index.js";



export type ConnectRequest = {
  target: string;
  runtime: OpenStrapRuntime;
  store: SqliteStateStore;
};

export type Connection = {
  /** Where the machine listens and what reached it, as the provider reports. */
  access: MachineAccess;
  /**
   * What was opened.
   *
   * Handed over rather than hidden behind a method or two of this module's choosing: the callers are
   * a person running a command on the machine and openstrap delivering itself to it, and no pair of
   * methods serves both without one of them being wrong.
   */
  transport: TransportConnection;
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

    return { access, transport: connection, close: () => connection.close() };
  }
}
