/** The image a target is pinned to is not the image that came back. */
export class PinnedImageChangedError extends Error {
  constructor(
    readonly target: string,
    readonly pinned: { reference: string; sha256?: string },
    readonly resolved: { reference: string; sha256?: string },
  ) {
    super(
      `Target "${target}" is pinned to ${named(pinned)}, but ${named(resolved)} is what it resolves to now. `
      + "Run create with --repin to make this the pinned image.",
    );
    this.name = "PinnedImageChangedError";
  }
}

/** The name and the digest, or the name alone where its publisher published no digest. */
function named(image: { reference: string; sha256?: string }): string {
  return image.sha256 === undefined ? image.reference : `${image.reference} ${image.sha256.slice(0, 12)}`;
}
