import type { Requirement, TargetlessRequirement } from "../../Requirements/index.js";
import type { Blueprint, BlueprintTarget, TargetScope, TargetType } from "../Domain/Blueprint.js";
import type { BlueprintConfig, BlueprintTargetConfig } from "../Schema/BlueprintConfig.js";

/**
 * Turns the blueprint a developer wrote into the targets a run works with.
 *
 * Requirements are written once at the top level and name their target, so
 * they are grouped here rather than repeated under every target.
 */
export function declaredTargets(config: BlueprintConfig): Blueprint {
  const requirements = groupRequirementsByTarget(config);
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
      requirements: requirements.get(name) ?? [],
    };
  }

  return { targets };
}

/**
 * Reports requirements that name a target the blueprint does not declare.
 *
 * The engine never guesses a target, so an unknown name is an error rather
 * than a requirement that quietly evaluates against nothing.
 */
export function unknownRequirementTargets(config: BlueprintConfig): readonly string[] {
  return [
    ...new Set(
      config.requirements
        .filter((requirement) => !Object.hasOwn(config.targets, requirement.target))
        .map((requirement) => requirement.target),
    ),
  ];
}

function groupRequirementsByTarget(config: BlueprintConfig): Map<string, TargetlessRequirement[]> {
  const grouped = new Map<string, TargetlessRequirement[]>();

  for (const requirement of config.requirements) {
    const existing = grouped.get(requirement.target) ?? [];

    existing.push(withoutTarget(requirement));
    grouped.set(requirement.target, existing);
  }

  return grouped;
}

function withoutTarget(requirement: Requirement): TargetlessRequirement {
  const { target: _target, ...rest } = requirement;

  return rest;
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
