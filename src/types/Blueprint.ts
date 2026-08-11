import type { Step } from "./Step.js";
import type { TargetlessRequirement } from "./Requirements.js";

/** A machine as a blueprint declares it. */
export type BlueprintTarget = {
  name: string;
  displayName?: string;
  transport?: string;
  provider?: string;
  image?: string;
  size?: string;
  requirements: TargetlessRequirement[];
  /** How the machine is brought to what the requirements declare. */
  steps?: readonly Step[];
};

export type Blueprint = {
  targets: Record<string, BlueprintTarget>;
};
