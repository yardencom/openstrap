import type { FactImportance } from "./FactImportance.js";
import type { FactPlatform } from "./FactPlatform.js";
import type { Redaction } from "./Redaction.js";

export type FactSettings = {
  importance: FactImportance;
  platforms?: FactPlatform[];
  timeoutMs?: number;
  maxOutputBytes?: number;
  redaction?: Redaction;
};
