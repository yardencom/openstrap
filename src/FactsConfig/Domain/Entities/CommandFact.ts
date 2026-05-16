import type { FactId } from "../ValueObjects/FactId.js";
import type { FactSettings } from "../ValueObjects/FactSettings.js";

export type CommandFact = {
  id: FactId;
} & FactSettings & {
  name: string;
  args?: string[];
};
