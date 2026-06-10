import type { FactId } from "../ValueObjects/FactId.js";
import type { FactSettings } from "../ValueObjects/FactSettings.js";
import type { SessionKind } from "../ValueObjects/SessionKind.js";

export type SessionFact = {
  id: FactId;
} & FactSettings & {
  kind?: SessionKind;
  owner?: string;
};
