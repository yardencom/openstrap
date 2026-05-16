import type { ConfigIssueDto } from "./ConfigDtos.js";

export class ConfigParseError extends Error {
  readonly issues: ConfigIssueDto[];

  constructor(issues: ConfigIssueDto[]) {
    super(`Invalid config document: ${issues.map((issue) => issue.message).join("; ")}`);
    this.name = "ConfigParseError";
    this.issues = issues;
  }
}

export class ConfigValidationError extends Error {
  readonly kind: string;
  readonly schemaId: string;
  readonly issues: ConfigIssueDto[];

  constructor(params: { kind: string; schemaId: string; issues: ConfigIssueDto[] }) {
    super(`Invalid ${params.kind} config: ${params.issues.map((issue) => issue.message).join("; ")}`);
    this.name = "ConfigValidationError";
    this.kind = params.kind;
    this.schemaId = params.schemaId;
    this.issues = params.issues;
  }
}
