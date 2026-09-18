import type { DeclaredService, Registry } from "./Services.js";
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
  /**
   * Whether a person will look at this machine.
   *
   * A machine openstrap makes is reached over a transport and has no screen, which is right for
   * everything it is normally asked for and wrong for a desktop: the machine boots, the desktop
   * runs, and there is nowhere for it to appear. Saying so is the blueprint's job — the hypervisor
   * cannot guess, and adding a screen to every machine is hardware nobody asked for.
   */
  display?: boolean;
  /** What runs on the machine. How it is run is openstrap's business, not the blueprint's. */
  services?: Readonly<Record<string, DeclaredService>>;
  /** Registries the images come from, where they need a login. */
  registries?: Readonly<Record<string, Registry>>;
  requirements: TargetlessRequirement[];
  /** How the machine is brought to what the requirements declare. */
  steps?: readonly Step[];
};

export type Blueprint = {
  targets: Record<string, BlueprintTarget>;
};
