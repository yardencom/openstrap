export class MissingProviderError extends Error {
  constructor(name: string) {
    super(`Target "${name}" declares no provider, so there is nothing to create it with`);
    this.name = "MissingProviderError";
  }
}
