import { execFileSync } from "node:child_process";

import type { ToolFact } from "../../Domain/Facts.js";

export function collectNodeTool(): ToolFact {
  return {
    status: "present",
    name: "node",
    version: process.versions.node,
    executable: true,
  };
}

export function collectCommandTool(name: string, args: readonly string[]): ToolFact {
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
