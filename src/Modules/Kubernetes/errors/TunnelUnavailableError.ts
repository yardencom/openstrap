export class TunnelUnavailableError extends Error {
  constructor() {
    super("the channel to this machine cannot carry a connection to the cluster; the transport has no tunnel");
    this.name = "TunnelUnavailableError";
  }
}
