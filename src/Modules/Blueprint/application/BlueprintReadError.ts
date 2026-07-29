import { type ConfigIssue } from "../../../ConfigCore/index.js";
import { BlueprintError } from "./BlueprintError.js";
import { ConfigParseError } from "../../../ConfigCore/index.js";
import { ConfigValidationError } from "../../../ConfigCore/index.js";


export class BlueprintReadError extends BlueprintError<ConfigIssue> {
  constructor(error: unknown) {
    if (!(error instanceof ConfigValidationError || error instanceof ConfigParseError)) {
      throw error;
    }

    super({
      name: "BlueprintReadError",
      message: "Invalid OpenStrap blueprint",
      details: error.issues,
    });
  }
}
