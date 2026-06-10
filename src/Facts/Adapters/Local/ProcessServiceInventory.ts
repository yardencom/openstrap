import { execFileSync } from "node:child_process";
import { platform } from "node:os";

import si from "systeminformation";

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
  async readProcesses(): Promise<ProcessInventoryEntry[]> {
    const result = await si.processes();

    return result.list.map((entry) => ({
      pid: entry.pid,
      ppid: entry.parentPid,
      user: entry.user,
      state: entry.state,
      name: stripExecutableExtension(entry.name),
      command: entry.command || entry.name || String(entry.pid),
      args: [entry.command, entry.params].filter(Boolean).join(" "),
      startedAt: entry.started,
    }));
  }

  async readServices(): Promise<ServiceInventoryEntry[]> {
    if (platform() === "darwin") {
      return readLaunchdServices();
    }

    const services = await si.services("*");

    return services.map((service) => ({
      name: service.name,
      manager: platform() === "win32" ? "windows-service-control-manager" : "service-manager",
      running: service.running,
      enabled: normalizeServiceEnabled(service.startmode),
      pids: service.pids,
      pid: service.pids?.[0],
      state: service.running ? "running" : "stopped",
    }));
  }
}

function readLaunchdServices(): ServiceInventoryEntry[] {
  return execFileSync("launchctl", ["list"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  })
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

function normalizeServiceEnabled(startmode: string | undefined): boolean | undefined {
  if (!startmode) {
    return undefined;
  }

  return !["disabled", "manual"].includes(startmode.toLowerCase());
}

function stripExecutableExtension(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.toLowerCase().endsWith(".exe") ? value.slice(0, -4) : value;
}
