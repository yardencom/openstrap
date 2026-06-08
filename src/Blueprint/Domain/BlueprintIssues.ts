import type { ConfigIssue } from "../../ConfigCore/index.js";

export type BlueprintValidationIssueCode =
  | "DUPLICATE_REQUIREMENT_ID"
  | "DUPLICATE_TARGET_NAME"
  | "EMPTY_BLUEPRINT"
  | "EMPTY_REQUIREMENT"
  | "UNSUPPORTED_TARGET"
  | "UNKNOWN_REQUIREMENT_TARGET";

export type BlueprintValidationIssue = ConfigIssue & {
  code: BlueprintValidationIssueCode;
};

export class BlueprintDocumentReadError extends Error {
  readonly issues: string[];
  readonly details: ConfigIssue[];

  constructor(details: ConfigIssue[]) {
    const issues = formatIssues(details);

    super(`Invalid OpenStrap blueprint document: ${issues.join("; ")}`);
    this.name = "BlueprintDocumentReadError";
    this.issues = issues;
    this.details = details;
  }
}

export class BlueprintValidationError extends Error {
  readonly issues: string[];
  readonly details: BlueprintValidationIssue[];

  constructor(details: BlueprintValidationIssue[]) {
    const issues = formatIssues(details);

    super(`Invalid OpenStrap blueprint: ${issues.join("; ")}`);
    this.name = "BlueprintValidationError";
    this.issues = issues;
    this.details = details;
  }
}

function formatIssues(details: readonly ConfigIssue[]): string[] {
  return details.map((issue) => {
    const location = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${location}${issue.message}`;
  });
}
