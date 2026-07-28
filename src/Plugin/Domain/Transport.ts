import type { Transport } from "../../Transport/index.js";
import type { SecretReference } from "./Secret.js";

export type TransportEndpoint = {
  host: string;
  port: number;
  user: string;
};

export type TransportConnectionRequest = {
  target: string;
  endpoint: TransportEndpoint;
  identity?: SecretReference;
  /**
   * Reveals a secret the core owns.
   *
   * A plugin is handed a reference and this function, never a value. The core
   * decides what may be revealed and stays the only thing that touches the
   * store, which is what keeps the rule true once plugins run out of process.
   */
  reveal?(reference: SecretReference): Promise<string | null>;
};

/**
 * An open channel plus the operations available through it, and the means to
 * close it again.
 */
export type TransportConnection = Transport & {
  close(): Promise<void>;
  /**
   * How this channel actually authenticated.
   *
   * Reported by the connector because the connector is the only thing that knows:
   * the machine does not know how anyone got in, and the caller only knows which
   * connector it asked for. A security promise — "this target accepts a key and
   * nothing else" — is worth nothing when the thing asserting it is the thing that
   * never checked.
   */
  authMethods: readonly string[];
};

/**
 * Opens a transport to a target.
 *
 * Establishing the channel is work of its own — a handshake, a key exchange, a
 * retry while a machine finishes booting — so it is a separate responsibility
 * from the operations the open channel offers.
 */
export type TransportConnector = {
  id: string;
  displayName?: string;
  connect(request: TransportConnectionRequest): Promise<TransportConnection>;
};
