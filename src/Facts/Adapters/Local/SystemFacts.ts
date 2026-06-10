import { cpus, freemem, homedir, loadavg, platform, release, tmpdir, totalmem, userInfo } from "node:os";

import type { FactSelectorTree } from "../../Domain/FactCollectionRequest.js";
import type {
  BaseSystem,
  FactScope,
  HostSystem,
  Network,
} from "../../Domain/Facts.js";
import { collectNetworkFacts } from "./NetworkFacts.js";
import { collectPathFact } from "./PathFacts.js";
import {
  collectCommandTool,
  collectNodeTool,
} from "./ToolFacts.js";
import {
  applyRequestedNetworkSelectors,
  applyRequestedSystemSelectors,
} from "./RequestedSelectorCoverage.js";

export function collectSystemFactsForScope(
  scope: FactScope,
  workspaceRoot: string,
  selectors: FactSelectorTree,
): HostSystem | BaseSystem | Network {
  if (scope === "network") {
    return applyRequestedNetworkSelectors(collectNetworkFacts(), selectors);
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
    network: collectNetworkFacts(),
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
        reason: "system_snapshot",
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
