import type { FactsCollectResult } from "../application/FactsCollectArgs.js";

/** Sections that hold things asked about by name, printed as counts. */
const namedSections = [
  "processes", "services", "users", "groups", "tools",
  "runtimes", "paths", "env", "commands", "artifacts",
] as const;

/**
 * What was read, as a person would want to see it.
 *
 * The sections that answer with one value each are printed as values; the ones that
 * are maps are printed as counts, because a machine with seven hundred processes on it
 * is not readable as a list and the stored result has every one of them.
 */
export function renderFactsOutput(output: FactsCollectResult): string {
  const item = output.facts[0]!;
  const data = item.snapshot.data as ReadMachine;
  const lines: string[] = [];

  lines.push(`OpenStrap facts collect: ${item.run.status}`);
  lines.push(`Target: ${item.snapshot.target.id}`);
  lines.push(`Snapshot: ${item.snapshot.id} factRun=${item.run.id}`);
  lines.push(`Result file: ${output.storage.resultPath}`);
  lines.push("");
  lines.push(`${data.os.display?.pretty ?? data.os.name} ${data.arch}, kernel ${data.os.kernel ?? "unknown"}`);
  lines.push(`cpu      ${data.cpu.cores} cores${data.cpu.model ? ` ${data.cpu.model}` : ""}`);
  lines.push(`memory   ${gigabytes(data.memory.availableBytes)} of ${gigabytes(data.memory.totalBytes)} available`);
  lines.push(`storage  ${gigabytes(data.storage.availableBytes)} of ${gigabytes(data.storage.totalBytes)} available`);
  lines.push(`user     ${readingAccount(data.users)} (${data.privileges.mode ?? "unknown"})`);
  lines.push("");

  for (const section of namedSections) {
    lines.push(`${section.padEnd(10)} ${Object.keys((data[section] ?? {}) as object).length}`);
  }

  lines.push("");

  return `${lines.join("\n")}\n`;
}

/** Only what this output prints; the snapshot holds a great deal more. */
type ReadMachine = {
  os: { name: string; kernel?: string; display?: { pretty?: string } };
  arch: string;
  cpu: { cores: number; model?: string };
  memory: { totalBytes?: number; availableBytes?: number };
  storage: { totalBytes?: number; availableBytes?: number };
  privileges: { mode?: string };
  users: Record<string, { name?: string }>;
} & Record<string, unknown>;

/** The account the reading ran as, which is always in `users` under its own name. */
function readingAccount(users: Record<string, { name?: string }>): string {
  return Object.values(users)[0]?.name ?? "unknown";
}

function gigabytes(bytes: number | undefined): string {
  return bytes === undefined ? "unknown" : `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}
