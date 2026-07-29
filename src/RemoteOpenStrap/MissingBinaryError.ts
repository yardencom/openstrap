export class MissingBinaryError extends Error {
  constructor(platform: string, path: string) {
    super(
      `openstrap has no build of itself for ${platform}. Expected it at ${path}. ` +
      "Build them with `npm run remote:build`.",
    );
    this.name = "MissingBinaryError";
  }
}
