import type { CreatedTarget } from "../Application/CreateCommand.js";

/**
 * What `create` did, and how to reach what it made.
 *
 * The steps are printed whether they ran or were skipped, because "already present"
 * is the answer to running the command twice and a reader has to be able to tell
 * that from "created".
 */
export function renderCreateOutput(name: string, result: CreatedTarget): string {
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
  lines.push(`  sha256 ${result.image.sha256}`);
  lines.push("");
  lines.push(`Machine: ${name} (${result.handle.id})`);

  if (result.requirementRun) {
    lines.push("");
    lines.push(`Requirements: ${result.requirementRun.status}`);

    for (const requirement of result.requirementRun.results) {
      lines.push(`  - ${requirement.requirementId}: ${requirement.status}`);
    }
  }

  lines.push("");
  lines.push(`Access:  ssh ${result.endpoint.user}@${result.endpoint.host} -p ${result.endpoint.port}`);
  lines.push(`         openstrap connect ${name}`);
  lines.push("");

  return lines.join("\n");
}
