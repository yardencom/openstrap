import type { ConfigIssue } from "../types/ConfigIssue.js";

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
