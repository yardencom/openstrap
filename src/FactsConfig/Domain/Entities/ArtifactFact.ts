import type { ArtifactCapture } from "../ValueObjects/ArtifactCapture.js";
import type { FactId } from "../ValueObjects/FactId.js";
import type { FactSettings } from "../ValueObjects/FactSettings.js";

export type ArtifactFact = {
  id: FactId;
} & FactSettings & {
  path: string;
  kind?: string;
  capture: ArtifactCapture;
};
