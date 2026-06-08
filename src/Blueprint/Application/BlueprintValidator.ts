import type { OpenStrapBlueprint } from "../Domain/Blueprint.js";
import {
  BlueprintValidationError,
  type BlueprintValidationIssue,
} from "../Domain/BlueprintIssues.js";

const requirementMetaFields = new Set(["id", "target", "optional"]);

export interface BlueprintValidationRule {
  validate(blueprint: OpenStrapBlueprint): BlueprintValidationIssue[];
}

export class BlueprintValidator {
  constructor(private readonly rules: readonly BlueprintValidationRule[] = defaultBlueprintValidationRules()) {}

  validate(blueprint: OpenStrapBlueprint): BlueprintValidationIssue[] {
    return this.rules.flatMap((rule) => rule.validate(blueprint));
  }

  assertValid(blueprint: OpenStrapBlueprint): void {
    const issues = this.validate(blueprint);

    if (issues.length > 0) {
      throw new BlueprintValidationError(issues);
    }
  }
}

export function defaultBlueprintValidationRules(): BlueprintValidationRule[] {
  return [
    new BlueprintMustHaveRunnableIntent(),
    new TargetNamesMustBeUnique(),
    new TargetsMustBeSupportedByV1Slice(),
    new RequirementIdsMustBeUnique(),
    new RequirementTargetsMustExist(),
    new RequirementsMustContainFactBlocks(),
  ];
}

export class BlueprintMustHaveRunnableIntent implements BlueprintValidationRule {
  validate(blueprint: OpenStrapBlueprint): BlueprintValidationIssue[] {
    if (blueprint.targets.length > 0 && blueprint.requirements.length > 0) {
      return [];
    }

    return [{
      path: [],
      message: "Blueprint must declare at least one target and one requirement",
      code: "EMPTY_BLUEPRINT",
    }];
  }
}

export class TargetNamesMustBeUnique implements BlueprintValidationRule {
  validate(blueprint: OpenStrapBlueprint): BlueprintValidationIssue[] {
    const seen = new Set<string>();
    const issues: BlueprintValidationIssue[] = [];

    blueprint.targets.forEach((target, index) => {
      if (seen.has(target.name)) {
        issues.push({
          path: ["targets", String(index), "name"],
          message: `Duplicate target name "${target.name}"`,
          code: "DUPLICATE_TARGET_NAME",
        });
      }

      seen.add(target.name);
    });

    return issues;
  }
}

export class TargetsMustBeSupportedByV1Slice implements BlueprintValidationRule {
  validate(blueprint: OpenStrapBlueprint): BlueprintValidationIssue[] {
    return blueprint.targets.flatMap((target, index): BlueprintValidationIssue[] => {
      if (target.transport === "local") {
        return [];
      }

      return [{
        path: ["targets", String(index), "transport"],
        message: `Target "${target.name}" uses unsupported transport "${target.transport}"`,
        code: "UNSUPPORTED_TARGET",
      }];
    });
  }
}

export class RequirementIdsMustBeUnique implements BlueprintValidationRule {
  validate(blueprint: OpenStrapBlueprint): BlueprintValidationIssue[] {
    const seen = new Set<string>();
    const issues: BlueprintValidationIssue[] = [];

    blueprint.requirements.forEach((requirement, index) => {
      if (seen.has(requirement.id)) {
        issues.push({
          path: ["requirements", String(index), "id"],
          message: `Duplicate requirement id "${requirement.id}"`,
          code: "DUPLICATE_REQUIREMENT_ID",
        });
      }

      seen.add(requirement.id);
    });

    return issues;
  }
}

export class RequirementTargetsMustExist implements BlueprintValidationRule {
  validate(blueprint: OpenStrapBlueprint): BlueprintValidationIssue[] {
    const targetNames = new Set(blueprint.targets.map((target) => target.name));

    return blueprint.requirements.flatMap((requirement, index): BlueprintValidationIssue[] => {
      if (targetNames.has(requirement.target)) {
        return [];
      }

      return [{
        path: ["requirements", String(index), "target"],
        message: `Unknown target "${requirement.target}"`,
        code: "UNKNOWN_REQUIREMENT_TARGET",
      }];
    });
  }
}

export class RequirementsMustContainFactBlocks implements BlueprintValidationRule {
  validate(blueprint: OpenStrapBlueprint): BlueprintValidationIssue[] {
    return blueprint.requirements.flatMap((requirement, index): BlueprintValidationIssue[] => {
      const factBlockCount = Object.keys(requirement).filter((field) => !requirementMetaFields.has(field)).length;

      if (factBlockCount > 0) {
        return [];
      }

      return [{
        path: ["requirements", String(index)],
        message: "Requirement must contain at least one fact-shaped block",
        code: "EMPTY_REQUIREMENT",
      }];
    });
  }
}
