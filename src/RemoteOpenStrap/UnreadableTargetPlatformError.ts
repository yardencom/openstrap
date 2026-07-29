export class UnreadableTargetPlatformError extends Error {
  constructor(detail: string) {
    super(`openstrap could not tell what kind of machine the target is: ${detail}`);
    this.name = "UnreadableTargetPlatformError";
  }
}
