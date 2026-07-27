import type { OperatingSystem } from "./OperatingSystem.js";
import type { Shell } from "./Shell.js";

/**
 * A named section of facts about a target.
 *
 * Entities that are checked by name — a process, a service, a tool — are
 * returned as a map keyed by that name, never as a list. A requirement asks
 * "is `ssh` running", and only a map can answer that.
 */
export interface Inventory {
  readonly section: string;
  collect(shell: Shell, operatingSystem: OperatingSystem): Promise<Record<string, unknown>>;
}

export type ProcessFact = {
  status: "present";
  pid: number;
  ppid?: number;
  user?: string;
  state?: string;
  name?: string;
  command: string;
  args?: string;
};

export type ServiceFact = {
  status: "present";
  manager: string;
  name: string;
  running?: boolean;
  enabled?: boolean;
  pid?: number;
  state?: string;
};

export type ToolFact = {
  status: "present" | "absent";
  type: string;
  executable: boolean;
  ready: boolean;
  path?: string;
  version?: string;
};

export type PathFact = {
  status: "present" | "absent";
  path: string;
  exists: boolean;
  type?: "file" | "directory" | "symlink" | "other";
  readable?: boolean;
  writable?: boolean;
  executable?: boolean;
};

/** Reads a `key=value` listing, which is how the readings collector answers. */
export function parseAssignments(output: string): Map<string, string> {
  const values = new Map<string, string>();

  for (const line of output.split("\n")) {
    const separator = line.indexOf("=");

    if (separator > 0) {
      values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
  }

  return values;
}

export function versionIn(output: string | null): string | undefined {
  return output?.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1];
}
