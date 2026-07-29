import type { ConfigIssue } from "../../../ConfigCore/index.js";

export abstract class BlueprintError<TIssue extends ConfigIssue> extends Error {
  readonly issues: string[];
  readonly details: TIssue[];

  constructor(params: {
    name: string;
    message: string;
    details: TIssue[];
  }) {
    const issues = params.details.map((issue) => {
      const location = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${location}${issue.message}`;
    });

    super(`${params.message}: ${issues.join("; ")}`);
    this.name = params.name;
    this.issues = issues;
    this.details = params.details;
  }
}
