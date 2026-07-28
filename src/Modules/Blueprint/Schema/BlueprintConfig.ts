import type { TargetlessRequirement } from "../../Requirements/index.js";

/**
 * The blueprint as written by a developer.
 *
 * It carries only what a person decides: what the target is, where it runs, how big
 * it is, and what has to be true of it. Scope, type, image url, checksum, signature,
 * format and boot mode are derived, never written here.
 *
 * Requirements live inside the target they are about. They were once a flat list
 * that named its target, which made every requirement repeat a name it could not be
 * without, and made "a requirement pointing at a target nobody declared" a state the
 * format allowed and the loader had to catch. Inside a target neither is possible.
 */
export type BlueprintTargetConfig = {
  displayName?: string;
  transport?: string;
  provider?: string;
  image?: string;
  size?: string;
  requirements?: TargetlessRequirement[];
};

export type BlueprintConfig = {
  targets: Record<string, BlueprintTargetConfig>;
};
