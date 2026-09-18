export class UnknownKindError extends Error {
  constructor(kind: string) {
    super(`openstrap does not know where the cluster keeps a ${kind}`);
    this.name = "UnknownKindError";
  }
}
