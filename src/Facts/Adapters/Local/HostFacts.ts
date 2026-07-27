import { createFactCollection } from "../../Domain/FactCollectionFactory.js";
import type { FactCollectionRequest, FactSelectorTree } from "../../Domain/FactCollectionRequest.js";
import type {
  FactCollection,
  FactCollectionItem,
  HostSystem,
} from "../../Domain/Facts.js";
import { collectProcessFacts, collectServiceFacts } from "./ProcessServiceFacts.js";
import {
  ProcessServiceInventory,
  type ProcessInventoryEntry,
  type ServiceInventoryEntry,
} from "./ProcessServiceInventory.js";
import { SystemSnapshot } from "./SystemSnapshot.js";

type CollectedProcessServiceInventory = {
  processes: readonly ProcessInventoryEntry[];
  services: readonly ServiceInventoryEntry[];
};

export class HostFacts {
  constructor(
    private readonly systemSnapshot = new SystemSnapshot(),
    private readonly processServiceInventory = new ProcessServiceInventory(),
  ) {}

  collect(params: FactCollectionRequest): FactCollection {
    const snapshots = this.systemSnapshot.collect(params);
    const inventory = this.readRequestedInventory(params);

    return createFactCollection(
      snapshots.map((snapshot) => this.addRequestedProcessServiceFacts(snapshot, params, inventory)),
    );
  }

  private readRequestedInventory(params: FactCollectionRequest): CollectedProcessServiceInventory {
    const processes = requestsFactSection(params, "processes")
      ? this.processServiceInventory.readProcesses()
      : [];
    const services = requestsFactSection(params, "services")
      ? this.processServiceInventory.readServices()
      : [];

    return {
      processes,
      services,
    };
  }

  private addRequestedProcessServiceFacts(
    item: FactCollectionItem,
    params: FactCollectionRequest,
    inventory: CollectedProcessServiceInventory,
  ): FactCollectionItem {
    const request = params.targets.find((targetRequest) => targetRequest.target.name === item.snapshot.target.id);
    const selectors = request?.selectors ?? {};
    const cloned = structuredClone(item) as FactCollectionItem;
    const data = cloned.snapshot.data as Partial<HostSystem>;

    if (hasOwn(selectors, "processes") && data.processes) {
      data.processes = collectProcessFacts(getRecord(selectors, "processes"), inventory.processes);
    }

    if (hasOwn(selectors, "services") && data.services) {
      data.services = collectServiceFacts(getRecord(selectors, "services"), inventory.services);
    }

    return cloned;
  }
}

function requestsFactSection(params: FactCollectionRequest, section: string): boolean {
  return params.targets.some((targetRequest) => hasOwn(targetRequest.selectors, section));
}

function getRecord(value: unknown, ...path: readonly string[]): FactSelectorTree {
  let current = value;

  for (const key of path) {
    if (!isRecord(current)) {
      return {};
    }

    current = current[key];
  }

  return isRecord(current) ? current : {};
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
