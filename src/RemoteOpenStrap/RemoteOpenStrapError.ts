export class RemoteOpenStrapError extends Error {
  constructor(detail: string) {
    super(`openstrap on the target did not answer: ${detail}`);
    this.name = "RemoteOpenStrapError";
  }
}
