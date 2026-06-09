import { execFileSync } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { networkInterfaces, cpus, freemem, homedir, loadavg, platform, release, tmpdir, totalmem, userInfo } from "node:os";
import { resolve } from "node:path";

import { createFactCollection } from "../Domain/FactCollectionFactory.js";
import type { FactCollectionRequest, FactSelectorTree } from "../Domain/FactCollectionRequest.js";
import type {
  BaseSystem,
  FactCollection,
  FactCollectionItem,
  FactScope,
  HostSystem,
  Network,
  NetworkInterface,
  PathFact,
  ToolFact,
} from "../Domain/Facts.js";

const schemaVersion = "facts.v1";

export class LocalProcessFactCollector {
  collect(params: FactCollectionRequest): FactCollection {
    const now = params.now ?? new Date();
    const timestamp = now.toISOString();
    const workspaceRoot = resolve(params.workspaceRoot ?? process.cwd());
    const items = params.targets.map((request): FactCollectionItem => {
      const target = request.target;
      const snapshotId = stableId("snap", target.name, timestamp);
      const runId = stableId("fact_run", target.name, timestamp);

      return {
        snapshot: {
          id: snapshotId,
          schemaVersion,
          scope: target.scope,
          target: {
            type: target.type,
            id: target.name,
            displayName: target.displayName,
          },
          data: collectDataForScope(target.scope, workspaceRoot, request.selectors),
        },
        run: {
          id: runId,
          snapshotId,
          startedAt: timestamp,
          finishedAt: timestamp,
          status: "success",
          attempt: params.attempt ?? 1,
        },
      };
    });

    return createFactCollection(items);
  }
}

function collectDataForScope(
  scope: FactScope,
  workspaceRoot: string,
  selectors: FactSelectorTree,
): HostSystem | BaseSystem | Network {
  if (scope === "network") {
    return applyRequestedNetworkSelectors(collectNetwork(), selectors);
  }

  const system = applyRequestedSystemSelectors(collectBaseSystem(workspaceRoot), selectors);

  if (scope === "host") {
    return {
      ...system,
      providers: {
        local: {
          status: "present",
          type: "local-process",
          available: true,
          capabilities: ["facts"],
        },
      },
      caches: {
        downloads: {
          path: tmpdir(),
        },
      },
    };
  }

  return system;
}

function collectBaseSystem(workspaceRoot: string): BaseSystem {
  const cpuEntries = cpus();
  const currentUser = safeUserInfo();
  const nodeTool = collectNodeTool();
  const npmTool = collectCommandTool("npm", ["--version"]);

  return {
    os: {
      family: normalizePlatform(platform()),
      name: platform(),
      version: release(),
      kernel: release(),
    },
    arch: normalizeArch(process.arch),
    cpu: {
      cores: cpuEntries.length,
      threads: cpuEntries.length,
      model: cpuEntries[0]?.model,
      load: loadavg(),
    },
    memory: {
      totalBytes: totalmem(),
      availableBytes: freemem(),
    },
    storage: {
      mounts: {
        workspace: {
          path: workspaceRoot,
        },
      },
    },
    network: collectNetwork(),
    users: {
      current: currentUser,
    },
    packages: {
      managers: {
        npm: {
          status: npmTool.status,
          name: "npm",
          version: npmTool.version,
        },
      },
    },
    processes: {},
    services: {},
    transports: {
      local: {
        status: "present",
        type: "local",
        endpoint: "process",
        ready: true,
      },
    },
    privileges: {
      mode: "local",
      admin: collectAdminFact(),
      sudo: {
        status: "unknown",
        reason: "not_collected",
      },
      become: {
        status: "unsupported",
        reason: "local_process_collector",
      },
    },
    runtimes: {
      node: {
        status: "present",
        type: "node",
        version: process.versions.node,
        ready: true,
      },
    },
    paths: {
      workspace: collectPathFact("workspace", workspaceRoot),
      home: collectPathFact("home", homedir()),
    },
    tools: {
      node: nodeTool,
      npm: npmTool,
    },
  };
}

function applyRequestedSystemSelectors<TSystem extends BaseSystem>(
  system: TSystem,
  selectors: FactSelectorTree,
): TSystem {
  ensureObservedSelectors(system.runtimes, selectedKeys(selectors, "runtimes"), (selector) => ({
    status: "unsupported" as const,
    type: selector,
    reason: "local_process_probe_not_declared",
  }));
  ensureObservedSelectors(system.services, selectedKeys(selectors, "services"), () => ({
    status: "unsupported" as const,
    reason: "local_process_probe_not_declared",
  }));
  ensureObservedSelectors(system.processes, selectedKeys(selectors, "processes"), () => ({
    status: "unsupported" as const,
    reason: "local_process_probe_not_declared",
  }));
  ensureObservedSelectors(system.transports, selectedKeys(selectors, "transports"), (selector) => ({
    status: "unsupported" as const,
    type: selector,
    reason: "local_process_probe_not_declared",
  }));
  ensureObservedSelectors(system.packages.managers, selectedKeys(selectors, "packages", "managers"), (selector) => ({
    status: "unsupported" as const,
    name: selector,
    reason: "local_process_probe_not_declared",
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
      reason: "local_process_probe_not_declared",
    }));
  }

  system.network = applyRequestedNetworkSelectors(system.network, getRecord(selectors, "network"));

  return system;
}

function applyRequestedNetworkSelectors(network: Network, selectors: FactSelectorTree): Network {
  ensureObservedSelectors(network.ports, selectedKeys(selectors, "ports"), (selector) => ({
    status: "unsupported" as const,
    protocol: "unknown",
    port: Number.parseInt(selector, 10) || 0,
    reason: "local_process_probe_not_declared",
  }));
  ensureObservedSelectors(network.reachability, selectedKeys(selectors, "reachability"), (selector) => ({
    status: "unsupported" as const,
    target: selector,
    reason: "local_process_probe_not_declared",
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

function collectNetwork(): Network {
  return {
    interfaces: Object.fromEntries(
      Object.entries(networkInterfaces()).map(([name, addresses]): [string, NetworkInterface] => [
        name,
        {
          name,
          addresses: (addresses ?? []).map((address) => ({
            ip: address.address,
            family: normalizeIpFamily(address.family),
            scope: address.internal ? "internal" : "external",
          })),
        },
      ]),
    ),
    dns: {},
    ports: {},
    firewall: {
      status: "unknown",
      reason: "not_collected",
    },
    reachability: {},
  };
}

function collectPathFact(name: string, path: string): PathFact {
  const base: PathFact = {
    status: "absent",
    path,
    exists: false,
  };

  try {
    const stat = statSync(path);

    return {
      ...base,
      status: "present",
      exists: true,
      type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other",
      readable: canAccess(path, constants.R_OK),
      writable: canAccess(path, constants.W_OK),
      executable: canAccess(path, constants.X_OK),
      sizeBytes: stat.size,
    };
  } catch {
    return {
      ...base,
      reason: `${name}_not_found`,
    };
  }
}

function collectNodeTool(): ToolFact {
  return {
    status: "present",
    name: "node",
    version: process.versions.node,
    executable: true,
  };
}

function collectCommandTool(name: string, args: readonly string[]): ToolFact {
  try {
    const version = execFileSync(name, [...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();

    return {
      status: "present",
      name,
      version,
      executable: true,
    };
  } catch {
    return {
      status: "absent",
      name,
      executable: false,
      reason: "command_not_found_or_not_executable",
    };
  }
}

function collectAdminFact() {
  if (typeof process.getuid !== "function") {
    return {
      status: "unknown" as const,
      reason: "uid_not_available",
    };
  }

  return {
    status: process.getuid() === 0 ? "present" as const : "absent" as const,
  };
}

function safeUserInfo(): Record<string, unknown> | undefined {
  try {
    const user = userInfo();

    return {
      username: user.username,
      uid: user.uid,
      gid: user.gid,
      shell: user.shell,
      homedir: user.homedir,
    };
  } catch {
    return undefined;
  }
}

function canAccess(path: string, mode: number): boolean {
  try {
    accessSync(path, mode);
    return true;
  } catch {
    return false;
  }
}

function normalizePlatform(value: NodeJS.Platform): string {
  const platforms: Partial<Record<NodeJS.Platform, string>> = {
    darwin: "macos",
    win32: "windows",
  };

  return platforms[value] ?? value;
}

function normalizeArch(value: string): string {
  const architectures: Record<string, string> = {
    amd64: "x64",
    x86_64: "x64",
    aarch64: "arm64",
  };

  return architectures[value] ?? value;
}

function normalizeIpFamily(value: string | number): string {
  return value === 4 || value === "IPv4" ? "ipv4" : value === 6 || value === "IPv6" ? "ipv6" : String(value);
}

function stableId(prefix: string, targetName: string, timestamp: string): string {
  return `${prefix}_${targetName}_${timestamp.replace(/[^0-9A-Za-z]/g, "")}`;
}
