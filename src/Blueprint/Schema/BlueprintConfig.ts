import type { Requirement } from "../../Requirements/index.js";

/**
 * The blueprint as written by a developer.
 *
 * It carries only what a person decides: what the target is, where it runs and
 * how big it is. Scope, type, image url, checksum, signature, format and boot
 * mode are derived, never written here.
 */
export type BlueprintTargetConfig = {
  displayName?: string;
  transport?: string;
  provider?: string;
  image?: string;
  size?: string;
};

export type BlueprintConfig = {
  targets: Record<string, BlueprintTargetConfig>;
  requirements: Requirement[];
};
