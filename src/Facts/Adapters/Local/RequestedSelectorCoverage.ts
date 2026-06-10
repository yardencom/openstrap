import type { FactSelectorTree } from "../../Domain/FactCollectionRequest.js";
import type {
  BaseSystem,
  Network,
} from "../../Domain/Facts.js";

export function applyRequestedSystemSelectors<TSystem extends BaseSystem>(
  system: TSystem,
  selectors: FactSelectorTree,
): TSystem {
  ensureObservedSelectors(system.runtimes, selectedKeys(selectors, "runtimes"), (selector) => ({
    status: "unsupported" as const,
    type: selector,
    reason: "system_probe_not_declared",
  }));
  ensureObservedSelectors(system.services, selectedKeys(selectors, "services"), () => ({
    status: "unsupported" as const,
    reason: "system_probe_not_declared",
  }));
  ensureObservedSelectors(system.processes, selectedKeys(selectors, "processes"), () => ({
    status: "unsupported" as const,
    reason: "system_probe_not_declared",
  }));
  ensureObservedSelectors(system.transports, selectedKeys(selectors, "transports"), (selector) => ({
    status: "unsupported" as const,
    type: selector,
    reason: "system_probe_not_declared",
  }));
  ensureObservedSelectors(system.packages.managers, selectedKeys(selectors, "packages", "managers"), (selector) => ({
    status: "unsupported" as const,
    name: selector,
    reason: "system_probe_not_declared",
  }));

  if (system.paths) {
    ensureObservedSelectors(system.paths, selectedKeys(selectors, "paths"), (selector) => ({
      status: "unsupported" as const,
      path: selector,
      exists: false,
      reason: "path_selector_not_declared",
    }));
  }

  if (system.tools) {
    ensureObservedSelectors(system.tools, selectedKeys(selectors, "tools"), (selector) => ({
      status: "unsupported" as const,
      name: selector,
      executable: false,
      reason: "system_probe_not_declared",
    }));
  }

  system.network = applyRequestedNetworkSelectors(system.network, getRecord(selectors, "network"));

  return system;
}

export function applyRequestedNetworkSelectors(network: Network, selectors: FactSelectorTree): Network {
  ensureObservedSelectors(network.ports, selectedKeys(selectors, "ports"), (selector) => ({
    status: "unsupported" as const,
    protocol: "unknown",
    port: Number.parseInt(selector, 10) || 0,
    reason: "system_probe_not_declared",
  }));
  ensureObservedSelectors(network.reachability, selectedKeys(selectors, "reachability"), (selector) => ({
    status: "unsupported" as const,
    target: selector,
    reason: "system_probe_not_declared",
  }));

  return network;
}

function ensureObservedSelectors<TValue>(
  facts: Record<string, TValue>,
  selectors: readonly string[],
  createMissing: (selector: string) => TValue,
): void {
  for (const selector of selectors) {
    if (!Object.prototype.hasOwnProperty.call(facts, selector)) {
      facts[selector] = createMissing(selector);
    }
  }
}

function selectedKeys(value: unknown, ...path: readonly string[]): string[] {
  const record = getRecord(value, ...path);
  return Object.keys(record);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
