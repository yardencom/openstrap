import { HostFacts } from "./Adapters/Local/HostFacts.js";
import type { Blueprint } from "../Blueprint/index.js";
import { createFactCollection } from "./Domain/FactCollectionFactory.js";
import type {
  FactCollectionRequest,
  FactSelectorTree,
} from "./Domain/FactCollectionRequest.js";
import type { FactCollectionItem } from "./Domain/Facts.js";

type FactsSource = {
  collect(request: FactCollectionRequest): Promise<readonly FactCollectionItem[]>;
};

type FactsRuntime = {
  factsBackend: FactsSource;
};

type FactsRequest = {
  blueprint: Blueprint;
  runtime?: FactsRuntime;
  workspaceRoot?: string;
  now?: Date;
  attempt?: number;
};

export class Facts extends Array<FactCollectionItem> {
  constructor(items: readonly FactCollectionItem[] = []) {
    super();

    if (Array.isArray(items)) {
      this.push(...createFactCollection(items));
    }
  }

  /**
   * Collects the facts a blueprint asks about.
   *
   * Collection is not done in the constructor: reaching a guest can mean
   * waiting on a network, and a constructor cannot wait.
   */
  static async collect(request: FactsRequest): Promise<Facts> {
    const source = request.runtime?.factsBackend ?? new HostFacts();
    const target = request.blueprint.target;
    const items = await source.collect({
      targets: [{
        target: {
          name: target.name,
          scope: target.scope,
          type: target.type,
          displayName: target.displayName,
          transport: target.transport,
        },
        selectors: selectorsFromRequirements(target.requirements),
      }],
      workspaceRoot: request.workspaceRoot,
      now: request.now,
      attempt: request.attempt,
    });

    return new Facts(items);
  }
}

function selectorsFromRequirements(requirements: readonly Record<string, unknown>[]): FactSelectorTree {
  return requirements.reduce<FactSelectorTree>((merged, requirement) => {
    return mergeSelectorTrees(merged, Object.fromEntries(
      Object.entries(requirement).filter(([key]) => key !== "id" && key !== "optional"),
    ));
  }, {});
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
