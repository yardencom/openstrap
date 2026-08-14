import type { CreatedTarget } from "../../application/CreateCommand.js";
import type { CommandText } from "../types.js";

/** What `create` did, and how to reach what it made. */
export class CreateText implements CommandText<CreatedTarget> {
  print(result: CreatedTarget): string {
    const lines: string[] = [];

    lines.push(`OpenStrap create: ${result.created ? "created" : "already present"}`);
    lines.push("");
    lines.push("Steps:");

    for (const step of result.steps) {
      lines.push(`  - ${step.name}: ${step.status}${step.detail ? ` (${step.detail})` : ""}`);
    }

    lines.push("");
    lines.push("Image:");
    lines.push(`  ${result.image.reference} ${result.image.format}/${result.image.boot}`);
    lines.push(`  ${result.image.url}`);
    // Only where its publisher published one. The word `undefined` under an image reads as a digest.
    if (result.image.sha256 !== undefined) {
      lines.push(`  sha256 ${result.image.sha256}`);
    }
    lines.push("");
    lines.push(`Machine: ${result.target} (${result.handle.id})`);

    if (result.requirementRun) {
      lines.push("");
      lines.push(`Requirements: ${result.requirementRun.status}`);

      for (const requirement of result.requirementRun.results) {
        lines.push(`  - ${requirement.requirementId}: ${requirement.status}`);
      }
    }

    lines.push("");
    // Named by whoever opened it. It was `ssh` in a literal here, which was right for as long as
    // there was one transport for it to be wrong about.
    const endpoint = result.access.endpoint;

    lines.push(`Access:  ${result.access.transport} ${endpoint.user}@${endpoint.host} -p ${endpoint.port}`);
    lines.push(`         openstrap connect ${result.target}`);
    lines.push("");

    return lines.join("\n");
  }
}
