import type { Target } from "./Target.js";
import type { TargetlessRequirement } from "./Requirements.js";

/**
 * A machine as a blueprint declares it: which machine, how it is reached, what it is made of, and
 * what has to be true of it.
 *
 * The identity is `Target` rather than four fields of its own, because a blueprint declaring a
 * machine and a snapshot reporting one are talking about the same machine.
 */
export type BlueprintTarget = Target & {
  transport: string;
  provider?: string;
  image?: string;
  size?: string;
  requirements: TargetlessRequirement[];
};

export type Blueprint = {
  targets: Record<string, BlueprintTarget>;
};
