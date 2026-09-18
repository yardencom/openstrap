/** Nothing answered. A different failure from a refusal, and a different thing to do about it. */
export class ServerUnreachableError extends Error {
  constructor(url: string, cause: unknown) {
    super(`openstrap-server at ${url} could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "ServerUnreachableError";
    this.cause = cause;
  }
}
