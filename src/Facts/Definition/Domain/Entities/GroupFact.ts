import type { FactId } from "../ValueObjects/FactId.js";
import type { FactSettings } from "../ValueObjects/FactSettings.js";

export type GroupFact = {
  id: FactId;
} & FactSettings & {
  name?: string;
  gid?: number | string;
};
