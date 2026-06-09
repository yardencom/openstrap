import { createHash } from "node:crypto";
import { basename } from "node:path";

import { createFactCollection } from "../Domain/FactCollectionFactory.js";
import type { FactCollectionRequest, FactSelectorTree } from "../Domain/FactCollectionRequest.js";
import type {
  FactCollection,
  FactCollectionItem,
  HostSystem,
  Process,
  Service,
} from "../Domain/Facts.js";
import { LocalHostInventoryCollector, type ProcessInventoryEntry, type ServiceInventoryEntry } from "./LocalHostInventoryCollector.js";
import { LocalProcessFactCollector } from "./LocalProcessFactCollector.js";

type RedactionStrategyName = "none" | "mask" | "hash" | "omit";

type Redaction = RedactionStrategyName | {
  strategy: RedactionStrategyName;
  fields?: string[];
  patterns?: string[];
};

export class SystemInformationFactCollector {
  constructor(
    private readonly baseCollector = new LocalProcessFactCollector(),
    private readonly inventoryCollector = new LocalHostInventoryCollector(),
  ) {}

  async collect(params: FactCollectionRequest): Promise<FactCollection> {
    const baseCollection = this.baseCollector.collect(params);
    const processInventory = shouldCollectSection(params, "processes")
      ? await this.inventoryCollector.collectProcesses()
      : [];
    const serviceInventory = shouldCollectSection(params, "services")
      ? await this.inventoryCollector.collectServices()
      : [];

    return createFactCollection(baseCollection.map((item) => {
      const request = params.targets.find((targetRequest) => targetRequest.target.name === item.snapshot.target.id);
      const selectors = request?.selectors ?? {};
      const cloned = structuredClone(item) as FactCollectionItem;
      const data = cloned.snapshot.data as Partial<HostSystem>;

      if (hasOwn(selectors, "processes") && data.processes) {
        data.processes = collectProcesses(getRecord(selectors, "processes"), processInventory);
      }

      if (hasOwn(selectors, "services") && data.services) {
        data.services = collectServices(getRecord(selectors, "services"), serviceInventory);
      }

      return cloned;
    }));
  }
}

function shouldCollectSection(params: FactCollectionRequest, section: string): boolean {
  return params.targets.some((targetRequest) => hasOwn(targetRequest.selectors, section));
}

function collectProcesses(
  selectors: FactSelectorTree,
  inventoryEntries: readonly ProcessInventoryEntry[],
): HostSystem["processes"] {
  const inventory = Object.fromEntries(inventoryEntries.map((entry) => [`pid-${entry.pid}`, {
    status: "present",
    pid: entry.pid,
    ppid: entry.ppid,
    user: entry.user,
    state: entry.state,
    name: entry.name ?? normalizeProcessName(entry.command),
    command: entry.command,
    args: redactSensitiveProcessArgs(entry.args),
  } satisfies Process]));
  const requested = Object.fromEntries(Object.entries(selectors).flatMap(([selectorId, value]) => {
    const selector = readProcessSelector(value);

    if (!selector.name && !selector.command) {
      return [];
    }

    const matches = inventoryEntries.filter((entry) => matchesProcess(entry, selector));

    return [[selectorId, matches.length > 0
      ? {
          status: "present" as const,
          name: selector.name,
          command: selector.command,
          pids: matches.map((match) => match.pid),
          entries: matches.slice(0, 20).map((match) => ({
            ...match,
            args: applyRedaction(match.args, selector.redaction),
          })),
        }
      : {
          status: "absent" as const,
          name: selector.name,
          command: selector.command,
        }]];
  }));

  return {
    ...inventory,
    ...requested,
  };
}

function collectServices(
  selectors: FactSelectorTree,
  inventoryEntries: readonly ServiceInventoryEntry[],
): HostSystem["services"] {
  const inventory = Object.fromEntries(inventoryEntries.map((service) => [service.name, {
    status: "present",
    manager: service.manager,
    name: service.name,
    running: service.running,
    enabled: service.enabled,
    pid: service.pid,
    state: service.state,
  } satisfies Service]));
  const requested = Object.fromEntries(Object.entries(selectors).flatMap(([selectorId, value]) => {
    const selector = readServiceSelector(value);

    if (!selector.name) {
      return [];
    }

    const entry = inventoryEntries.find((candidate) => {
      return candidate.name === selector.name || candidate.name.includes(selector.name!);
    });

    return [[selectorId, entry
      ? {
          status: "present" as const,
          manager: selector.manager ?? entry.manager,
          name: selector.name,
          running: entry.running,
          pid: entry.pid,
          state: entry.state,
        }
      : {
          status: "absent" as const,
          manager: selector.manager,
          name: selector.name,
        }]];
  }));

  return {
    ...inventory,
    ...requested,
  };
}

type ProcessSelector = {
  name?: string;
  command?: string;
  redaction?: Redaction;
};

type ServiceSelector = {
  name?: string;
  manager?: string;
};

function readProcessSelector(value: unknown): ProcessSelector {
  if (!isRecord(value)) {
    return {};
  }

  return {
    name: typeof value.name === "string" ? value.name : undefined,
    command: typeof value.command === "string" ? value.command : undefined,
    redaction: isRedaction(value.redaction) ? value.redaction : undefined,
  };
}

function readServiceSelector(value: unknown): ServiceSelector {
  if (!isRecord(value)) {
    return {};
  }

  return {
    name: typeof value.name === "string" ? value.name : undefined,
    manager: typeof value.manager === "string" ? value.manager : undefined,
  };
}

function matchesProcess(entry: ProcessInventoryEntry, selector: ProcessSelector): boolean {
  if (selector.name) {
    const commandName = entry.name ?? normalizeProcessName(entry.command);
    const expectedName = normalizeProcessName(selector.name);

    return commandName === expectedName || entry.args.includes(selector.name);
  }

  if (selector.command) {
    return entry.args.includes(selector.command);
  }

  return false;
}

function normalizeProcessName(value: string): string {
  const name = basename(value);

  return name.toLowerCase().endsWith(".exe") ? name.slice(0, -4) : name;
}

function redactSensitiveProcessArgs(args: string): string {
  return [
    /token=\S+/gi,
    /password=\S+/gi,
    /secret=\S+/gi,
    /api[_-]?key=\S+/gi,
  ].reduce((current, pattern) => current.replace(pattern, "[masked]"), args);
}

function applyRedaction(output: string, redaction: Redaction | undefined): string {
  if (!redaction || redaction === "none") {
    return output;
  }

  const strategy = typeof redaction === "string" ? redaction : redaction.strategy;

  if (strategy === "omit") {
    return "";
  }

  if (strategy === "mask") {
    if (typeof redaction === "string" || !redaction.patterns || redaction.patterns.length === 0) {
      return "[masked]";
    }

    return redaction.patterns.reduce((current, pattern) => current.replace(new RegExp(pattern, "g"), "[masked]"), output);
  }

  if (strategy === "hash") {
    return createHash("sha256").update(output).digest("hex");
  }

  return output;
}

function isRedaction(value: unknown): value is Redaction {
  return typeof value === "string" || isRecord(value);
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
