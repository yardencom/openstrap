/**
 * What kind of machine a target is: what a build for it has to be built for.
 *
 * Known when openstrap creates the machine — the provider resolved the image, so it knows what
 * platform a machine made from it runs and what it was built for — and written down then. openstrap
 * used to work it out again on every reading, by reading the header of the target's `/bin/sh` and
 * telling ELF from Mach-O. That answered a question it had already answered, and it answered it
 * about a machine rather than about what openstrap had decided to make.
 *
 * The words here are the words openstrap's builds are named with: `linux-arm64`, `macos-arm64`.
 */
export class TargetPlatform {
  private constructor(
    readonly name: string,
    readonly architecture: string,
  ) {}

  static of(name: string, architecture: string): TargetPlatform {
    return new TargetPlatform(name, architecture);
  }

  get id(): string {
    return `${this.name}-${this.architecture}`;
  }
}
