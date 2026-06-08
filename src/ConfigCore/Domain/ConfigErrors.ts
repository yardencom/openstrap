import type { ConfigIssue } from "./ConfigIssue.js";

export class ConfigParseError extends Error {
  readonly issues: ConfigIssue[];

  constructor(issues: ConfigIssue[]) {
    super(`Invalid config: ${issues.map((issue) => issue.message).join("; ")}`);
    this.name = "ConfigParseError";
    this.issues = issues;
  }
}

export class ConfigNotFoundError extends Error {
  constructor(message = "Config file was not found") {
    super(message);
    this.name = "ConfigNotFoundError";
  }
}

export class ConfigReadError extends Error {
  readonly cause: unknown;

  constructor(params: { message: string; cause: unknown }) {
    super(params.message);
    this.name = "ConfigReadError";
    this.cause = params.cause;
  }
}

export class ConfigValidationError extends Error {
  readonly kind: string;
  readonly schemaId: string;
  readonly issues: ConfigIssue[];

  constructor(params: { kind: string; schemaId: string; issues: ConfigIssue[] }) {
    super(`Invalid ${params.kind} config: ${params.issues.map((issue) => issue.message).join("; ")}`);
    this.name = "ConfigValidationError";
    this.kind = params.kind;
    this.schemaId = params.schemaId;
    this.issues = params.issues;
  }
}
