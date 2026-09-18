export class ClusterNotReadyError extends Error {
  constructor(waitedMs: number) {
    super(`the cluster did not answer within ${Math.round(waitedMs / 1000)}s of being installed`);
    this.name = "ClusterNotReadyError";
  }
}
