import type { TargetlessRequirement, Requirement } from "../../Requirements/index.js";
import type { BlueprintTarget, OpenStrapBlueprint } from "./Blueprint.js";

export type HostBlueprintSection = {
  displayName?: string;
  requirements: TargetlessRequirement[];
};

export type HostBlueprintDocument = {
  host: HostBlueprintSection;
};

export type ExplicitBlueprintDocument = {
  targets: BlueprintTarget[];
  requirements: Requirement[];
};

export type BlueprintDocument = HostBlueprintDocument | ExplicitBlueprintDocument;

export function isHostBlueprintDocument(document: BlueprintDocument): document is HostBlueprintDocument {
  return "host" in document;
}

export function isExplicitBlueprintDocument(document: BlueprintDocument): document is OpenStrapBlueprint {
  return "targets" in document && "requirements" in document;
}
