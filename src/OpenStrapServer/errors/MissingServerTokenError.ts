/** A server was named and nothing was given to reach it with. */
export class MissingServerTokenError extends Error {
  constructor(url: string) {
    super(
      `OPENSTRAP_SERVER_URL names ${url} but OPENSTRAP_TOKEN is not set, so there is nothing to `
      + "authenticate with. Set the token, or unset the url to work on this machine alone.",
    );
    this.name = "MissingServerTokenError";
  }
}
