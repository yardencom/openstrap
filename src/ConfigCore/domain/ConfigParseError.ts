import type { ConfigIssue } from "./ConfigIssue.js";

export class ConfigParseError extends Error {
  readonly issues: ConfigIssue[];

  constructor(issues: ConfigIssue[]) {
    super(`Invalid config: ${issues.map((issue) => issue.message).join("; ")}`);
    this.name = "ConfigParseError";
    this.issues = issues;
  }
}
