/** A name nobody has published a bootable image under, and what the catalogue does have. */
export class UnknownImageError extends Error {
  constructor(reference: string, search: string, near: readonly string[], architecture: string) {
    const found = near.length === 0
      ? `Nothing is published under "${search}".`
      : `Published under "${search}", but not built for ${architecture}: ${near.slice(0, 8).join(", ")}.`;

    super(
      `No machine image is published as "${reference}". ${found} `
      + "openstrap keeps no list of operating systems: it asks the public box registry by name, so "
      + "the name to write is the one the registry uses — a release is part of it, as in `debian12` "
      + "or `debian:12`. An exact box may be named in full, as in `generic/debian12`.",
    );
    this.name = "UnknownImageError";
  }
}
