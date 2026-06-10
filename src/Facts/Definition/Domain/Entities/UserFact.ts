import type { FactId } from "../ValueObjects/FactId.js";
import type { FactSettings } from "../ValueObjects/FactSettings.js";

export type UserFact = {
  id: FactId;
} & FactSettings & {
  name?: string;
  uid?: number | string;
};
