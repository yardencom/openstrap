import { MachineNotRunningError } from "./errors/MachineNotRunningError.js";
import { UnknownMachineError } from "./errors/UnknownMachineError.js";
import { UnrecognisedMachineKindError } from "./errors/UnrecognisedMachineKindError.js";
import type {
  MachineAccess,
  OpenStrapRuntime,
  SecretReference,
  TransportConnection,
} from "../../Plugin/index.js";
import { ServerRefusedError, type OpenStrapServer } from "../../Server/index.js";
import type { SqliteStateStore } from "../../StateStore/index.js";
import type { MachinePlatform } from "#types/Machine.js";
import type { TargetScope, TargetType } from "#types/Target.js";

export { UnknownMachineError } from "./errors/UnknownMachineError.js";
export { UnrecognisedMachineKindError } from "./errors/UnrecognisedMachineKindError.js";

export type ConnectRequest = {
  target: string;
  runtime: OpenStrapRuntime;
  /** This machine's own record, which is where a machine lives when a run has no server. */
  store?: SqliteStateStore;
  /** The record a team shares. Where there is one it is the record, and the store is not asked. */
  server?: OpenStrapServer;
};

export type Connection = {
  /** Where the machine listens and what reached it, as the provider reports. */
  access: MachineAccess;
  /** What was opened. */
  transport: TransportConnection;
  /** What kind of machine this is, as it was recorded when it was made. */
  kind: { scope: TargetScope; type: TargetType };
  /** What a build of openstrap for it has to be built for; absent where no image was ever recorded. */
  machine?: MachinePlatform;
  close(): Promise<void>;
};

/**
 * A machine as whatever recorded it describes it.
 *
 * Told, not read: what the machine is right now is asked of the provider a few lines later. This is
 * only what was written down when it was made, and the two answer different questions.
 */
type Recorded = {
  provider: string;
  resourceId: string;
  scope: TargetScope;
  type: TargetType;
  machine?: MachinePlatform;
  /** A key to look up, where a store holds it. */
  identity?: SecretReference;
  /** The key itself, where a server issued it and there is nothing to look up. */
  privateKey?: string;
};

/**
 * openstrap's own words for what a machine is.
 *
 * Written out because the contract publishes them as types and a type cannot be checked at run time,
 * and this is where a string from somewhere else becomes one of them. `scope: "machine"` reached a
 * snapshot once by being a `string` all the way down (ADR 0009).
 */
const scopes = ["host", "guest", "network"] as const;
const types = ["vm", "container", "host"] as const;

/** Opens a session to a target, hiding how it is reached. */
export class Connect {
  async execute(request: ConnectRequest): Promise<Connection> {
    const recorded = request.server
      ? await Connect.fromServer(request.server, request.target)
      : Connect.fromStore(request.store, request.target);

    const provider = request.runtime.providers.require(recorded.provider);
    const handle = { id: recorded.resourceId, name: request.target };
    const state = await provider.inspect(handle);

    if (state.status !== "running") {
      throw new MachineNotRunningError(request.target, state.status);
    }

    const access = await provider.access(handle);
    const connector = request.runtime.transports.require(access.transport);

    const connection = await connector.connect({
      target: request.target,
      endpoint: access.endpoint,
      identity: recorded.identity ?? (recorded.privateKey === undefined ? undefined : Connect.issued(request.target)),
      // Asked of the store the reference names, not of a store openstrap picked — except where the
      // value came with the record and there is nothing to look up.
      reveal: async (reference) => recorded.privateKey
        ?? await request.runtime.secretStores.require(reference.store).read(reference),
    });

    return {
      access,
      transport: connection,
      kind: { scope: recorded.scope, type: recorded.type },
      ...(recorded.machine ? { machine: recorded.machine } : {}),
      close: () => connection.close(),
    };
  }

  /** A machine this openstrap made, on this machine, with nothing shared. */
  private static fromStore(store: SqliteStateStore | undefined, target: string): Recorded {
    const resource = store?.readProviderResource(target);
    const recorded = store?.readTarget(target);

    if (!store || !resource || !recorded) {
      throw new UnknownMachineError(target);
    }

    const image = store.readMachineImage(target);
    const identity = store.readSecretReference(target, "ssh-identity");

    return {
      provider: resource.provider,
      resourceId: resource.resourceId,
      scope: recorded.scope,
      type: recorded.type,
      ...(image ? { machine: { platform: image.platform, architecture: image.architecture } } : {}),
      ...(identity ? { identity: { store: identity.store, name: identity.name } } : {}),
    };
  }

  /** A machine the organization has, wherever it was made and by whom. */
  private static async fromServer(server: OpenStrapServer, target: string): Promise<Recorded> {
    const access = await server.targetAccess(target).catch((error: unknown) => {
      // The server's word for it is "this organization has no machine called that", which is the
      // same thing openstrap says when its own store has no row. One name for one situation.
      if (error instanceof ServerRefusedError && error.status === 404) {
        throw new UnknownMachineError(target);
      }

      throw error;
    });

    return {
      provider: access.provider,
      resourceId: access.resourceId,
      scope: Connect.oneOf(scopes, access.scope, target, "scope"),
      type: Connect.oneOf(types, access.type, target, "type"),
      ...(access.machine ? { machine: access.machine } : {}),
      privateKey: access.identity.privateKey,
    };
  }

  /** The key came with the record, so this names where it came from rather than where to find it. */
  private static issued(target: string): SecretReference {
    return { store: "openstrap-server", name: `${target}.ssh-identity` };
  }

  private static oneOf<TWord extends string>(
    known: readonly TWord[],
    value: string,
    target: string,
    field: "scope" | "type",
  ): TWord {
    const word = known.find((candidate) => candidate === value);

    if (word === undefined) {
      throw new UnrecognisedMachineKindError(target, field, value, known);
    }

    return word;
  }
}
