/**
 * Nothing said whether this run belongs to the organization's record or to this machine alone.
 *
 * Staying local used to be what happened when something was missing — an unset variable, and later
 * a secret store with no token in it. Both meant a run went ahead against a record nobody else
 * could see, and nothing anywhere said so. Which of the two a run is, is a decision, and a decision
 * that nobody made is not the same as one made quietly.
 */
export class NoServerTokenError extends Error {
  constructor(readonly address: string, reason: "no store" | "no token") {
    // Two causes, two things to do about them. One sentence for both told somebody with a secret
    // store already registered to go and register one.
    super(
      (reason === "no store"
        ? `No secret store is registered, so there is nowhere a token for ${address} could be kept. `
          + "Register a secret store plugin"
        : `The secret store holds no token for ${address}. Put one there`)
      + ", or run with --local to keep this run to this machine.",
    );
    this.name = "NoServerTokenError";
  }
}
