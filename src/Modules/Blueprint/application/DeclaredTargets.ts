import type { Blueprint, BlueprintTarget, TargetScope, TargetType } from "../domain/Blueprint.js";
import type { BlueprintConfig, BlueprintTargetConfig } from "../schema/BlueprintConfig.js";

/**
 * Turns the blueprint a developer wrote into the targets a run works with.
 *
 * Only what can be derived is added: which kind of machine a target is, and how it is
 * reached. Requirements are already where they belong — inside the target they are
 * about — so nothing is regrouped and nothing can point at a target that is not there.
 */
export function declaredTargets(config: BlueprintConfig): Blueprint {
  const targets: Record<string, BlueprintTarget> = {};

  for (const [name, target] of Object.entries(config.targets)) {
    targets[name] = {
      name,
      ...derivedKind(target),
      displayName: target.displayName,
      transport: target.transport ?? defaultTransport(target),
      provider: target.provider,
      image: target.image,
      size: target.size,
      requirements: target.requirements ?? [],
    };
  }

  return { targets };
}

/**
 * A target driven by a provider is a machine openstrap manages; anything else
 * is the machine openstrap itself runs on.
 */
function derivedKind(target: BlueprintTargetConfig): { scope: TargetScope; type: TargetType } {
  return target.provider === undefined
    ? { scope: "host", type: "host" }
    : { scope: "guest", type: "vm" };
}

function defaultTransport(target: BlueprintTargetConfig): string {
  return target.provider === undefined ? "local" : "ssh";
}
