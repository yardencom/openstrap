import { accessSync, constants, statSync } from "node:fs";

import type { PathFact } from "../../Domain/Facts.js";

export function collectPathFact(name: string, path: string): PathFact {
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

function canAccess(path: string, mode: number): boolean {
  try {
    accessSync(path, mode);
    return true;
  } catch {
    return false;
  }
}
