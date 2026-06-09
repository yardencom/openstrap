import type { FactScope } from "../../Facts/index.js";
import type { Requirement } from "../../Requirements/index.js";

export type BlueprintTargetType = "machine" | "vm" | "network";

export type BlueprintTarget = {
  name: string;
  scope: FactScope;
  type: BlueprintTargetType;
  displayName?: string;
  transport: "local";
};

export type OpenStrapBlueprint = {
  targets: BlueprintTarget[];
  requirements: Requirement[];
};

export function targetNames(blueprint: OpenStrapBlueprint): Set<string> {
  return new Set(blueprint.targets.map((target) => target.name));
}
