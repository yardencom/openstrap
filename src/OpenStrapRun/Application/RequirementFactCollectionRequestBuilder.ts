import type { TargetlessRequirement } from "../../Requirements/index.js";

const requirementMetaFields = new Set(["id", "optional"]);

export type FactCollectionTarget = {
  name: string;
  scope: string;
  type: string;
  displayName?: string;
  transport: string;
};

export type FactSelectorTree = Record<string, unknown>;

export type FactTargetCollectionRequest = {
  target: FactCollectionTarget;
  selectors: FactSelectorTree;
};

export type FactCollectionRequest = {
  targets: readonly FactTargetCollectionRequest[];
  workspaceRoot?: string;
  now?: Date;
  attempt?: number;
};

export class RequirementFactCollectionRequestBuilder {
  build(params: {
    target: FactCollectionTarget;
    requirements: readonly TargetlessRequirement[];
    workspaceRoot?: string;
    now?: Date;
    attempt?: number;
  }): FactCollectionRequest {
    const selectors = params.requirements.reduce<FactSelectorTree>(
      (merged, requirement) => mergeSelectorTrees(merged, extractRequestedSelectors(requirement)),
      {},
    );

    return {
      targets: [{
        target: params.target,
        selectors,
      }],
      workspaceRoot: params.workspaceRoot,
      now: params.now,
      attempt: params.attempt,
    };
  }
}

function extractRequestedSelectors(requirement: TargetlessRequirement): FactSelectorTree {
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
