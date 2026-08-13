import { MachineNotRunningError } from "./errors/MachineNotRunningError.js";
import { UnknownMachineError } from "./errors/UnknownMachineError.js";
import { UnrecognisedMachineKindError } from "./errors/UnrecognisedMachineKindError.js";
import type { MachineAccess, OpenStrapRuntime, TransportConnection } from "../../Plugin/index.js";
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
  /** Where a server keeps the record it holds this too; on this machine the provider is asked. */
  resourceId?: string;
  scope: TargetScope;
  type: TargetType;
  machine?: MachinePlatform;
  /** The key itself, where a server issued it. Absent means the connector has its own. */
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
    // Asked of the provider where nothing recorded an id: it knows its own machines by name, and an
    // id remembered here is a second answer that goes stale the moment a machine is remade.
    const handle = recorded.resourceId === undefined
      ? await provider.find(request.target)
      : { id: recorded.resourceId, name: request.target };

    if (!handle) {
      throw new UnknownMachineError(request.target);
    }

    const state = await provider.inspect(handle);

    if (state.status !== "running") {
      throw new MachineNotRunningError(request.target, state.status);
    }

    const access = await provider.access(handle);
    const connector = request.runtime.transports.require(access.transport);

    // No key where the record holds none: the connector made this machine's key and knows where it
    // put it. A key is passed only when something else owns it, which is a server issuing one for a
    // machine a whole organization can reach.
    const connection = await connector.connect({
      target: request.target,
      endpoint: access.endpoint,
      ...(recorded.privateKey === undefined ? {} : { privateKey: recorded.privateKey }),
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
    const recorded = store?.readTarget(target);

    if (!store || !recorded?.provider) {
      throw new UnknownMachineError(target);
    }

    const image = store.readMachineImage(target);

    return {
      provider: recorded.provider,
      scope: recorded.scope,
      type: recorded.type,
      ...(image ? { machine: { platform: image.platform, architecture: image.architecture } } : {}),
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
