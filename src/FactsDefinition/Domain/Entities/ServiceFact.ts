import type { FactId } from "../ValueObjects/FactId.js";
import type { FactSettings } from "../ValueObjects/FactSettings.js";

export type ServiceFact = {
  id: FactId;
} & FactSettings & {
  name: string;
  manager?: string;
};
