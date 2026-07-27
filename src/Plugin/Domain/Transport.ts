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
};

/**
 * An open channel plus the operations available through it, and the means to
 * close it again.
 */
export type TransportConnection = Transport & {
  close(): Promise<void>;
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
