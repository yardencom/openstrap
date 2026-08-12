import type { Transport } from "./ports/Transport.js";

export type TransportEndpoint = {
  host: string;
  port: number;
  user: string;
};

/** The public half of what a channel will enter a machine with. */
export type TransportIdentity = {
  publicKey: string;
};

export type TransportConnectionRequest = {
  target: string;
  endpoint: TransportEndpoint;
  /**
   * The key to enter with, where the caller has one.
   *
   * Absent means the connector's own: it made the key for this target and knows
   * where it put it. Present means something else owns it — a server that issues
   * a key for a machine a whole organization can reach — and openstrap is passing
   * it through for this connection and keeping none of it.
   */
  privateKey?: string;
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
  /**
   * The public half of the key this channel will enter the named machine with,
   * made now or reused from the last time it was asked.
   *
   * Asked before the machine exists, because the public half has to be planted
   * in it as it is made. Keys are this connector's business and not openstrap's:
   * openstrap holds none, and what it plants it got from here.
   */
  identityFor(target: string): Promise<TransportIdentity>;
  connect(request: TransportConnectionRequest): Promise<TransportConnection>;
};
