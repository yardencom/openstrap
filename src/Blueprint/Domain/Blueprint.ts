import type { TargetlessRequirement } from "../../Requirements/index.js";

/**
 * Selects which schema of facts is collected from a target.
 */
export type TargetScope = "host" | "guest" | "network";

/**
 * Says what the target is. It need not match the scope: a container is scope
 * `guest` and type `container` — the same fact schema, a different thing.
 */
export type TargetType = "vm" | "container" | "host";

export type BlueprintTarget = {
  name: string;
  scope: TargetScope;
  type: TargetType;
  displayName?: string;
  transport: string;
  provider?: string;
  image?: string;
  size?: string;
  requirements: TargetlessRequirement[];
};

export type Blueprint = {
  targets: Record<string, BlueprintTarget>;
};
