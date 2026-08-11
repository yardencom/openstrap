/** The image a target is pinned to is not the image that came back. */
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
