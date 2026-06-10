import type { TargetlessRequirement } from "../../Requirements/index.js";

type BlueprintTarget = {
  name: string;
  scope: string;
  type: string;
  displayName?: string;
  transport: string;
};

export type Blueprint = {
  target: BlueprintTarget & {
    requirements: TargetlessRequirement[];
  };
};
