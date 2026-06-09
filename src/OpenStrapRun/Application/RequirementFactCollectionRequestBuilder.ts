import type { Requirement } from "../../Requirements/index.js";
import type { FactCollectionTarget } from "../../Facts/index.js";
import type {
  FactCollectionRequest,
  FactSelectorTree,
  FactTargetCollectionRequest,
} from "../../Facts/index.js";

const requirementMetaFields = new Set(["id", "target", "optional"]);

export class RequirementFactCollectionRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequirementFactCollectionRequestError";
  }
}

export class RequirementFactCollectionRequestBuilder {
  build(params: {
    targets: readonly FactCollectionTarget[];
    requirements: readonly Requirement[];
    workspaceRoot?: string;
    now?: Date;
    attempt?: number;
  }): FactCollectionRequest {
    const targetsByName = new Map(params.targets.map((target) => [target.name, target]));
    const targetRequests = new Map<string, FactTargetCollectionRequest>();

    for (const requirement of params.requirements) {
      const target = targetsByName.get(requirement.target);

      if (!target) {
        throw new RequirementFactCollectionRequestError(`Cannot collect facts for unknown target "${requirement.target}"`);
      }

      const request = targetRequests.get(target.name) ?? {
        target,
        selectors: {},
      };

      request.selectors = mergeSelectorTrees(request.selectors, extractRequestedSelectors(requirement));
      targetRequests.set(target.name, request);
    }

    return {
      targets: [...targetRequests.values()],
      workspaceRoot: params.workspaceRoot,
      now: params.now,
      attempt: params.attempt,
    };
  }
}

function extractRequestedSelectors(requirement: Requirement): FactSelectorTree {
  return Object.fromEntries(
    Object.entries(requirement).filter(([key]) => !requirementMetaFields.has(key)),
  );
}

function mergeSelectorTrees(left: FactSelectorTree, right: FactSelectorTree): FactSelectorTree {
  const merged: FactSelectorTree = {
    ...left,
  };

  for (const [key, value] of Object.entries(right)) {
    const current = merged[key];
    merged[key] = isRecord(current) && isRecord(value)
      ? mergeSelectorTrees(current, value)
      : value;
  }

  return merged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
