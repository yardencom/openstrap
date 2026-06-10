import type { FactId } from "../ValueObjects/FactId.js";
import type { FactSettings } from "../ValueObjects/FactSettings.js";
import type { FileRequirement } from "../ValueObjects/FileRequirement.js";

export type FileFact = {
  id: FactId;
} & FactSettings & {
  path: string;
  require?: FileRequirement[];
};
