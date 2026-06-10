import { statSync } from "node:fs";
import { resolve } from "node:path";

import type { FactsDefinition } from "../Definition/Domain/Entities/FactsDefinition.js";
import { interpolateDefinitionInput } from "./DefinitionInputs.js";
import type { ArtifactEvidence } from "./Evidence.js";

export function collectArtifactEvidence(
  definition: FactsDefinition,
  inputs: Record<string, string>,
  workspaceRoot: string,
): Record<string, ArtifactEvidence> {
  return Object.fromEntries((definition.artifacts ?? []).map((artifact) => {
    const path = resolve(workspaceRoot, interpolateDefinitionInput(artifact.path, inputs));

    try {
      const stat = statSync(path);

      return [artifact.id, {
        status: "present" as const,
        path,
        kind: artifact.kind,
        type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other",
        sizeBytes: stat.size,
      }];
    } catch {
      return [artifact.id, {
        status: "absent" as const,
        path,
        kind: artifact.kind,
        reason: "artifact_path_not_found",
      }];
    }
  }));
}
