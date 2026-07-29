export class UnsupportedPlatformError extends Error {
  constructor(reported: string) {
    super(`openstrap does not know how to read facts from "${reported}"`);
    this.name = "UnsupportedPlatformError";
  }
}
