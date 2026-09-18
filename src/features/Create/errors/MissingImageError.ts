/**
 * Nothing said what to make the machine out of.
 *
 * openstrap used to answer this itself with `ubuntu:24.04`, written into the code in two places: a
 * machine nobody said an operating system for came out Ubuntu, and the run reported success. What
 * was asked for and what was made were different things, and nothing anywhere said so.
 */
export class MissingImageError extends Error {
  constructor(name: string) {
    super(
      `Nothing says what to make "${name}" from. Name an operating system with --os, `
      + "or declare `image:` for it in the blueprint.",
    );
    this.name = "MissingImageError";
  }
}
