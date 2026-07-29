export class ConfigReadError extends Error {
  readonly cause: unknown;

  constructor(params: { message: string; cause: unknown }) {
    super(params.message);
    this.name = "ConfigReadError";
    this.cause = params.cause;
  }
}
