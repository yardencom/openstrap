import type { ConfigIssue } from "../../ConfigCore/index.js";

export class FactsDefinitionValidationError extends Error {
  readonly issues: string[];
  readonly details: ConfigIssue[];

  constructor(details: ConfigIssue[]) {
    const issues = details.map((issue) => {
      const location = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${location}${issue.message}`;
    });

    super(`Invalid facts definition: ${issues.join("; ")}`);
    this.name = "FactsDefinitionValidationError";
    this.issues = issues;
    this.details = details;
  }
}
