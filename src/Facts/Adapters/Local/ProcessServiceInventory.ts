import { execFileSync } from "node:child_process";
import { platform } from "node:os";

export type ProcessInventoryEntry = {
  pid: number;
  ppid?: number;
  user?: string;
  state?: string;
  name?: string;
  command: string;
  args: string;
  startedAt?: string;
};

export type ServiceInventoryEntry = {
  name: string;
  manager: string;
  running?: boolean;
  enabled?: boolean;
  pid?: number;
  pids?: number[];
  state?: string;
};

export class ProcessServiceInventory {
  readProcesses(): ProcessInventoryEntry[] {
    if (platform() === "win32") {
      return readWindowsProcesses();
    }

    return readPosixProcesses();
  }

  readServices(): ServiceInventoryEntry[] {
    if (platform() === "darwin") {
      return readLaunchdServices();
    }

    if (platform() === "win32") {
      return readWindowsServices();
    }

    return readSystemdServices();
  }
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

function stripExecutableExtension(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.toLowerCase().endsWith(".exe") ? value.slice(0, -4) : value;
}
