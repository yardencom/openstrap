import type { FactId } from "../ValueObjects/FactId.js";
import type { FactSettings } from "../ValueObjects/FactSettings.js";

export type ProcessFact = {
  id: FactId;
} & FactSettings & {
  name?: string;
  command?: string;
  pidFile?: string;
};
