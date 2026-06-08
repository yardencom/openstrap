import type { Requirement, TargetlessRequirement } from "../Domain/Requirements.js";

export function bindRequirementsToTarget(
  requirements: readonly TargetlessRequirement[],
  target: string,
): Requirement[] {
  return requirements.map((requirement) => ({
    ...requirement,
    target,
  }));
}
