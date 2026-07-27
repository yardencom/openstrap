import { HostFacts } from "./Adapters/Local/HostFacts.js";
import { TargetFacts } from "./Adapters/Remote/TargetFacts.js";
import type { Transport } from "../Transport/index.js";
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

type TransportFactsRequest = {
  transport: Transport;
  target: {
    name: string;
    scope: string;
    type: string;
    displayName?: string;
    transport: string;
  };
  now?: Date;
  attempt?: number;
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
    const items = await source.collect({
      targets: Object.values(request.blueprint.targets).map((target) => ({
        target: {
          name: target.name,
          scope: target.scope,
          type: target.type,
          displayName: target.displayName,
          transport: target.transport,
        },
        selectors: selectorsFromRequirements(target.requirements),
      })),
      workspaceRoot: request.workspaceRoot,
      now: request.now,
      attempt: request.attempt,
    });

    return new Facts(items);
  }

  /**
   * Collects from a target reached over a transport.
   *
   * The host goes through this too, over the local transport. There is no
   * separate path for it: the host is a target that happens to be reached by
   * system calls.
   */
  static async collectOverTransport(request: TransportFactsRequest): Promise<Facts> {
    return new Facts(await new TargetFacts(request.transport).collect({
      targets: [{ target: request.target, selectors: {} }],
      now: request.now,
      attempt: request.attempt,
    }));
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
