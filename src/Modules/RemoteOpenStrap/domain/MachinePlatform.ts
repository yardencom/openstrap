/**
 * What kind of machine a target is: what a build for it has to be built for.
 *
 * Known when openstrap creates the machine — the provider resolved the image, so it knows what a
 * machine made from it runs and what it was built for — and recorded then. openstrap used to work it
 * out again on every reading, by reading the header of the target's `/bin/sh`, which answered a
 * question it had already answered.
 *
 * The words are the words openstrap's builds are named with: `linux`, `macos`, and `arm64`, `x64`.
 */
export type MachinePlatform = {
  platform: string;
  architecture: string;
};
