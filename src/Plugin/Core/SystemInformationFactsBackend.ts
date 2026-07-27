import { execFileSync } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { cpus, freemem, homedir, loadavg, platform, release, tmpdir, totalmem, userInfo } from "node:os";
import { basename, resolve } from "node:path";

import type {
  FactsBackend,
  FactsBackendCollection,
  FactsBackendCollectionItem,
  FactsBackendCollectionRequest,
  FactsBackendSelectorTree,
} from "../Domain/FactsBackend.js";

type ProcessInventoryEntry = {
  pid: number;
  ppid?: number;
  user?: string;
  state?: string;
  name?: string;
  command: string;
  args: string;
  startedAt?: string;
};

type ServiceInventoryEntry = {
  name: string;
  manager: string;
  running?: boolean;
  enabled?: boolean;
  pid?: number;
  pids?: number[];
  state?: string;
};

export function createSystemInformationFactsBackend(id: string): FactsBackend {
  return {
    id,
    displayName: "System information",
    capabilities: {
      scopes: ["host"],
      sections: [
        "os",
        "arch",
        "cpu",
        "memory",
        "storage",
        "network",
        "users",
        "packages",
        "processes",
        "services",
        "transports",
        "privileges",
        "runtimes",
        "paths",
        "tools",
        "env",
      ],
    },
    collect: collectSystemInformationFacts,
  };
}

async function collectSystemInformationFacts(request: FactsBackendCollectionRequest): Promise<FactsBackendCollection> {
  const now = request.now ?? new Date();
  const timestamp = now.toISOString();
  const workspaceRoot = resolve(request.workspaceRoot ?? process.cwd());
  const processes = requestsSection(request, "processes") ? readProcesses() : [];
  const services = requestsSection(request, "services") ? readServices() : [];

  return request.targets.map((targetRequest): FactsBackendCollectionItem => {
    const target = targetRequest.target;
    const snapshotId = stableFactId("snap", target.name, timestamp);

    return {
      snapshot: {
        id: snapshotId,
        schemaVersion: "facts.v1",
        scope: target.scope,
        target: {
          type: target.type,
          id: target.name,
          displayName: target.displayName,
        },
        data: collectSystemFacts(workspaceRoot, targetRequest.selectors, processes, services),
      },
      run: {
        id: stableFactId("fact_run", target.name, timestamp),
        snapshotId,
        startedAt: timestamp,
        finishedAt: timestamp,
        status: "success",
        attempt: request.attempt ?? 1,
      },
    };
  });
}

function collectSystemFacts(
  workspaceRoot: string,
  selectors: FactsBackendSelectorTree,
  processes: readonly ProcessInventoryEntry[],
  services: readonly ServiceInventoryEntry[],
): Record<string, unknown> {
  const nodeTool = collectCommandTool("node", ["--version"]);
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
      cores: cpus().length,
      threads: cpus().length,
      model: cpus()[0]?.model,
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
    network: {
      interfaces: {},
      dns: {},
      ports: {},
      firewall: {
        status: "unknown",
        reason: "not_collected",
      },
      reachability: {},
    },
    users: {
      current: safeUserInfo(),
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
    processes: hasOwn(selectors, "processes") ? collectProcessFacts(readRecord(selectors.processes), processes) : {},
    services: hasOwn(selectors, "services") ? collectServiceFacts(readRecord(selectors.services), services) : {},
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
      workspace: collectPathFact(workspaceRoot),
      home: collectPathFact(homedir()),
    },
    tools: {
      node: nodeTool,
      npm: npmTool,
    },
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

function readProcesses(): ProcessInventoryEntry[] {
  if (platform() === "win32") {
    return readWindowsProcesses();
  }

  return readPosixProcesses();
}

function readServices(): ServiceInventoryEntry[] {
  if (platform() === "darwin") {
    return readLaunchdServices();
  }

  if (platform() === "win32") {
    return readWindowsServices();
  }

  return readSystemdServices();
}

function readPosixProcesses(): ProcessInventoryEntry[] {
  return safeExecFile("ps", ["-axo", "pid=,ppid=,user=,state=,comm=,args="])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s*(.*)$/);

      if (!match) {
        return [];
      }

      const [, pid, ppid, user, state, command, args] = match;

      return [{
        pid: Number(pid),
        ppid: Number(ppid),
        user,
        state,
        name: stripExecutableExtension(command),
        command: command!,
        args: args ? `${command} ${args}` : command!,
      }];
    });
}

function readWindowsProcesses(): ProcessInventoryEntry[] {
  return safeExecFile("wmic", ["process", "get", "ProcessId,ParentProcessId,Name,CommandLine", "/format:csv"])
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Node,"))
    .flatMap((line) => {
      const parts = line.split(",");
      const command = parts[1] ?? "";
      const name = parts[2] ?? "";
      const ppid = Number(parts[3]);
      const pid = Number(parts[4]);

      if (!pid) {
        return [];
      }

      return [{
        pid,
        ppid: Number.isFinite(ppid) ? ppid : undefined,
        name: stripExecutableExtension(name),
        command: command || name || String(pid),
        args: command || name || String(pid),
      }];
    });
}

function readLaunchdServices(): ServiceInventoryEntry[] {
  return safeExecFile("launchctl", ["list"])
    .split("\n")
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 3)
    .map(([pid, status, name]) => ({
      name: name!,
      manager: "launchd",
      running: /^\d+$/.test(pid!) && Number(pid) > 0,
      pid: /^\d+$/.test(pid!) ? Number(pid) : undefined,
      pids: /^\d+$/.test(pid!) ? [Number(pid)] : [],
      state: status,
    }));
}

function readSystemdServices(): ServiceInventoryEntry[] {
  return safeExecFile("systemctl", ["list-units", "--type=service", "--all", "--no-legend", "--no-pager"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts[0]?.endsWith(".service"))
    .map((parts) => ({
      name: parts[0]!,
      manager: "systemd",
      running: parts[3] === "running",
      state: parts[3],
    }));
}

function readWindowsServices(): ServiceInventoryEntry[] {
  const lines = safeExecFile("sc", ["query", "state=", "all"]).split("\n");
  const services: ServiceInventoryEntry[] = [];
  let currentName: string | undefined;

  for (const line of lines) {
    const serviceName = line.match(/SERVICE_NAME:\s*(.+)$/);

    if (serviceName) {
      currentName = serviceName[1]?.trim();
      continue;
    }

    const state = line.match(/STATE\s+:\s+\d+\s+(\S+)/);

    if (state && currentName) {
      services.push({
        name: currentName,
        manager: "windows-service-control-manager",
        running: state[1] === "RUNNING",
        state: state[1]?.toLowerCase(),
      });
      currentName = undefined;
    }
  }

  return services;
}

function safeExecFile(command: string, args: readonly string[]): string {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

function collectProcessFacts(
  selectors: Record<string, unknown>,
  inventoryEntries: readonly ProcessInventoryEntry[],
): Record<string, unknown> {
  const inventory = Object.fromEntries(inventoryEntries.map((entry) => [`pid-${entry.pid}`, {
    status: "present",
    pid: entry.pid,
    ppid: entry.ppid,
    user: entry.user,
    state: entry.state,
    name: entry.name ?? normalizeProcessName(entry.command),
    command: entry.command,
    args: redactSensitiveProcessArgs(entry.args),
  }]));
  const requested = Object.fromEntries(Object.entries(selectors).flatMap(([selectorId, value]) => {
    const selector = readProcessSelector(value);

    if (!selector.name && !selector.command) {
      return [];
    }

    const matches = inventoryEntries.filter((entry) => matchesProcess(entry, selector));

    return [[selectorId, matches.length > 0
      ? {
          status: "present",
          name: selector.name,
          command: selector.command,
          pids: matches.map((match) => match.pid),
          entries: matches.slice(0, 20).map((match) => ({
            ...match,
            args: applyRedaction(match.args, selector.redaction),
          })),
        }
      : {
          status: "absent",
          name: selector.name,
          command: selector.command,
        }]];
  }));

  return {
    ...inventory,
    ...requested,
  };
}

function collectServiceFacts(
  selectors: Record<string, unknown>,
  inventoryEntries: readonly ServiceInventoryEntry[],
): Record<string, unknown> {
  const inventory = Object.fromEntries(inventoryEntries.map((service) => [service.name, {
    status: "present",
    manager: service.manager,
    name: service.name,
    running: service.running,
    enabled: service.enabled,
    pid: service.pid,
    state: service.state,
  }]));
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
          status: "present",
          manager: selector.manager ?? entry.manager,
          name: selector.name,
          running: entry.running,
          pid: entry.pid,
          state: entry.state,
        }
      : {
          status: "absent",
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

type Redaction = string | {
  strategy?: string;
  patterns?: string[];
};

function readProcessSelector(value: unknown): ProcessSelector {
  if (!isRecord(value)) {
    return {};
  }

  return {
    name: typeof value.name === "string" ? value.name : undefined,
    command: typeof value.command === "string" ? value.command : undefined,
    redaction: typeof value.redaction === "string" || isRecord(value.redaction) ? value.redaction : undefined,
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

function collectPathFact(path: string): Record<string, unknown> {
  const base = {
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
      reason: "path_not_found",
    };
  }
}

function collectCommandTool(name: string, args: readonly string[]): Record<string, unknown> {
  try {
    const output = execFileSync(name, [...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    }).trim();

    return {
      status: "present",
      type: name,
      version: output.replace(/^v/, ""),
      ready: true,
    };
  } catch {
    return {
      status: "absent",
      type: name,
      ready: false,
    };
  }
}

function collectAdminFact(): Record<string, unknown> {
  if (typeof process.getuid !== "function") {
    return {
      status: "unknown",
      reason: "uid_not_available",
    };
  }

  return {
    status: process.getuid() === 0 ? "present" : "absent",
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

function requestsSection(request: FactsBackendCollectionRequest, section: string): boolean {
  return request.targets.some((targetRequest) => hasOwn(targetRequest.selectors, section));
}

function stableFactId(prefix: string, targetName: string, timestamp: string): string {
  return `${prefix}_${targetName}_${timestamp.replace(/[^0-9A-Za-z]/g, "")}`;
}

function normalizeProcessName(value: string): string {
  const name = basename(value);

  return stripExecutableExtension(name) ?? name;
}

function stripExecutableExtension(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.toLowerCase().endsWith(".exe") ? value.slice(0, -4) : value;
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

  return output;
}

function canAccess(path: string, mode: number): boolean {
  try {
    accessSync(path, mode);
    return true;
  } catch {
    return false;
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
