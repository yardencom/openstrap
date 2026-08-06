import type { Step } from "./Step.js";
import type { TargetlessRequirement } from "./Requirements.js";

/**
 * A machine as a blueprint declares it: which machine, what it is made of, and what has to be true
 * of it.
 *
 * What kind of machine it is and how it is reached are not here, because a blueprint does not know
 * them. It used to carry `scope`, `type` and `transport` filled in by the loader — `guest`, `vm`,
 * `ssh` written as literals because a provider had been named at all. The provider is the one that
 * makes the machine and hands back the channel to it, and it says both: `capabilities` is what kind
 * of machine it makes, `access()` is what reached the one it made. A blueprint that names a
 * `transport` is a person overriding that, and is used as written.
 */
export type BlueprintTarget = {
  name: string;
  displayName?: string;
  transport?: string;
  provider?: string;
  image?: string;
  size?: string;
  requirements: TargetlessRequirement[];
  /**
   * How this machine is brought to what the requirements declare, where a person says so.
   *
   * Optional in a way requirements are not: a blueprint that declares what a machine must be is
   * complete on its own, and openstrap will check it and report. Steps are the other half — what to
   * do when it falls short — and nothing has to write them, because a resolver from a plugin may
   * know instead, and because checking without converging is a use of its own.
   */
  steps?: readonly Step[];
};

export type Blueprint = {
  targets: Record<string, BlueprintTarget>;
};
