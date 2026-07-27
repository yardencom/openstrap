import {
  ConfigParseError,
  ConfigValidationError,
  type ConfigIssue,
} from "../../ConfigCore/index.js";

abstract class BlueprintError<TIssue extends ConfigIssue> extends Error {
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

export class BlueprintTargetError extends Error {
  readonly issues: string[];

  constructor(unknownTargets: readonly string[], declaredTargets: readonly string[]) {
    const issues = unknownTargets.map(
      (target) => `requirement target "${target}" is not declared. Declared targets: ${declaredTargets.join(", ")}`,
    );

    super(`Invalid OpenStrap blueprint: ${issues.join("; ")}`);
    this.name = "BlueprintTargetError";
    this.issues = issues;
  }
}

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
