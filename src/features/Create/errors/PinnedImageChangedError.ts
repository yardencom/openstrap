/**
 * The image a target is pinned to is not the image that came back.
 *
 * A failure rather than a new pin, because the point of a pin is that the second machine is made
 * from the first machine's file. Something moved upstream, or the blueprint now asks for a
 * different image; either way it is a decision, and `--repin` is how a person makes it.
 */
export class PinnedImageChangedError extends Error {
  constructor(
    readonly target: string,
    readonly pinned: { reference: string; sha256: string },
    readonly resolved: { reference: string; sha256: string },
  ) {
    super(
      `Target "${target}" is pinned to ${pinned.reference} ${pinned.sha256.slice(0, 12)}, `
      + `but ${resolved.reference} now resolves to ${resolved.sha256.slice(0, 12)}. `
      + "Run create with --repin to make this the pinned image.",
    );
    this.name = "PinnedImageChangedError";
  }
}
