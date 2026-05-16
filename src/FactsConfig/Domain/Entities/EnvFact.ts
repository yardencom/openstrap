import type { FactId } from "../ValueObjects/FactId.js";
import type { FactSettings } from "../ValueObjects/FactSettings.js";

export type EnvFact = {
  id: FactId;
} & FactSettings & {
  names: string[];
};
