import type { FactsCollectResult } from "../../application/FactsCollectCommand.js";
import type { CommandText } from "../types.js";

/** Sections that hold things asked about by name, printed as counts. */
const namedSections = [
  "processes", "services", "users", "groups", "tools",
  "runtimes", "paths", "env", "commands", "artifacts",
] as const;

/** Only what this reads out; the snapshot holds a great deal more. */
type ReadMachine = {
  os: { name: string; kernel?: string; display?: { pretty?: string } };
  arch: string;
  cpu: { cores: number; model?: string };
  memory: { totalBytes?: number; availableBytes?: number };
  storage: { totalBytes?: number; availableBytes?: number };
  privileges: { mode?: string };
  users: Record<string, { name?: string }>;
} & Record<string, unknown>;

/**
 * What was read, as a person would want to see it.
 *
 * The sections that answer with one value each are printed as values; the ones that are
 * maps are printed as counts, because a machine with seven hundred processes on it is not
 * readable as a list and the stored result has every one of them.
 */
export class FactsText implements CommandText<FactsCollectResult> {
  print(result: FactsCollectResult): string {
    const snapshot = result.snapshot;
    const machine = snapshot.data as ReadMachine;
    const lines: string[] = [];

    lines.push(`OpenStrap facts collect: ${snapshot.reading.status}`);
    lines.push(`Target: ${snapshot.target.id}`);
    lines.push(`Snapshot: ${snapshot.id}`);
    lines.push(`Result file: ${result.storage.resultPath}`);
    lines.push("");
    lines.push(`${machine.os.display?.pretty ?? machine.os.name} ${machine.arch}, kernel ${machine.os.kernel ?? "unknown"}`);
    lines.push(`cpu      ${machine.cpu.cores} cores${machine.cpu.model ? ` ${machine.cpu.model}` : ""}`);
    lines.push(`memory   ${this.gigabytes(machine.memory.availableBytes)} of ${this.gigabytes(machine.memory.totalBytes)} available`);
    lines.push(`storage  ${this.gigabytes(machine.storage.availableBytes)} of ${this.gigabytes(machine.storage.totalBytes)} available`);
    lines.push(`user     ${this.readingAccount(machine.users)} (${machine.privileges.mode ?? "unknown"})`);
    lines.push("");

    for (const section of namedSections) {
      lines.push(`${section.padEnd(10)} ${Object.keys((machine[section] ?? {}) as object).length}`);
    }

    lines.push("");

    return `${lines.join("\n")}\n`;
  }

  /** The account the reading ran as, which is always in `users` under its own name. */
  private readingAccount(users: Record<string, { name?: string }>): string {
    return Object.values(users)[0]?.name ?? "unknown";
  }

  private gigabytes(bytes: number | undefined): string {
    return bytes === undefined ? "unknown" : `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  }
}
