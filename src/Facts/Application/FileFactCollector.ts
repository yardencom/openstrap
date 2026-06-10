import { accessSync, constants, statSync } from "node:fs";
import { resolve } from "node:path";

import type { PathFact } from "../Domain/Facts.js";
import type { FileFact } from "../Definition/Domain/Entities/FileFact.js";
import { FileRequirement } from "../Definition/Domain/ValueObjects/FileRequirement.js";
import { interpolateDefinitionInput } from "./DefinitionInputs.js";

export function collectFileFacts(
  files: readonly FileFact[],
  inputs: Record<string, string>,
  workspaceRoot: string,
): Record<string, PathFact> {
  return Object.fromEntries(files.map((file) => [
    file.id,
    collectPathFact(resolve(workspaceRoot, interpolateDefinitionInput(file.path, inputs)), file.require),
  ]));
}

function collectPathFact(path: string, requirements: readonly FileRequirement[] | undefined): PathFact {
  const base: PathFact = {
    status: "absent",
    path,
    exists: false,
  };

  try {
    const stat = statSync(path);
    const fact: PathFact = {
      ...base,
      status: "present",
      exists: true,
      type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other",
      readable: canAccess(path, constants.R_OK),
      writable: canAccess(path, constants.W_OK),
      executable: canAccess(path, constants.X_OK),
      sizeBytes: stat.size,
    };

    return requirementsSatisfied(fact, requirements)
      ? fact
      : {
          ...fact,
          status: "error",
          reason: "file_requirements_not_satisfied",
        };
  } catch {
    return {
      ...base,
      reason: "path_not_found",
    };
  }
}

function requirementsSatisfied(path: PathFact, requirements: readonly FileRequirement[] | undefined): boolean {
  if (!requirements) {
    return true;
  }

  return requirements.every((requirement) => {
    if (requirement === FileRequirement.Exists) return path.exists === true;
    if (requirement === FileRequirement.Absent) return path.exists === false;
    if (requirement === FileRequirement.File) return path.type === "file";
    if (requirement === FileRequirement.Directory) return path.type === "directory";
    if (requirement === FileRequirement.Readable) return path.readable === true;
    if (requirement === FileRequirement.Writable) return path.writable === true;
    if (requirement === FileRequirement.Executable) return path.executable === true;
    return true;
  });
}

function canAccess(path: string, mode: number): boolean {
  try {
    accessSync(path, mode);
    return true;
  } catch {
    return false;
  }
}
