import type { Requirement } from "../../Requirements/index.js";
import type { FactCollectionTarget } from "../Domain/Facts.js";
import type {
  FactCollectionRequest,
  FactSelectorTree,
  FactTargetCollectionRequest,
} from "../Domain/FactCollectionRequest.js";

const requirementMetaFields = new Set(["id", "target", "optional"]);

export class FactCollectionPlanningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FactCollectionPlanningError";
  }
}

export class FactCollectionPlanner {
  plan(params: {
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
        throw new FactCollectionPlanningError(`Cannot plan facts for unknown target "${requirement.target}"`);
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
