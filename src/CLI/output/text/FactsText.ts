import type { FactsCollectResult } from "../../application/FactsCollectCommand.js";
import type { CommandText } from "../types.js";

/** Sections that hold things asked about by name, printed as counts. */
const namedSections = [
  "processes", "services", "users", "groups", "tools",
  "runtimes", "paths", "env", "commands", "artifacts",
] as const;

/**
 * Only what this reads out, and every part of it optional.
 *
 * Optional because a reading is only as wide as what was asked for: a blueprint that requires two
 * things produces a snapshot with two things in it, and no `os`, no `arch`, no `storage`. This
 * printer used to assume all of them and died on the first narrowed reading — `Cannot read properties
 * of undefined (reading 'display')` — while the same reading printed as JSON without complaint.
 */
type ReadMachine = {
  os?: { name?: string; kernel?: string; display?: { pretty?: string } };
  arch?: string;
  cpu?: { cores?: number; model?: string };
  memory?: { totalBytes?: number; availableBytes?: number };
  storage?: { totalBytes?: number; availableBytes?: number };
  privileges?: { mode?: string };
  users?: Record<string, { name?: string }>;
} & Record<string, unknown>;

/**
 * What was read, as a person would want to see it.
 *
 * The sections that answer with one value each are printed as values; the ones that are maps are
 * printed as counts, because a machine with seven hundred processes on it is not readable as a list
 * and the stored result has every one of them.
 *
 * A section that was not asked about is not printed. Printing `unknown` for it would say something
 * false — that openstrap looked and could not tell — when the truth is that nobody asked.
 */
export class FactsText implements CommandText<FactsCollectResult> {
  print(result: FactsCollectResult): string {
    const snapshot = result;
    const machine = snapshot.facts as unknown as ReadMachine;
    const lines: string[] = [];

    lines.push(`OpenStrap facts collect: ${snapshot.reading.status}`);
    lines.push(`Target: ${snapshot.target.id}`);
    lines.push(`Snapshot: ${snapshot.id}`);
    lines.push("");

    const machineLines = [
      this.system(machine),
      machine.cpu && `cpu      ${machine.cpu.cores ?? "unknown"} cores${machine.cpu.model ? ` ${machine.cpu.model}` : ""}`,
      machine.memory && `memory   ${this.gigabytes(machine.memory.availableBytes)} of ${this.gigabytes(machine.memory.totalBytes)} available`,
      machine.storage && `storage  ${this.gigabytes(machine.storage.availableBytes)} of ${this.gigabytes(machine.storage.totalBytes)} available`,
      machine.privileges && `user     ${this.readingAccount(machine.users)} (${machine.privileges.mode ?? "unknown"})`,
    ].filter((line): line is string => typeof line === "string");

    if (machineLines.length > 0) {
      lines.push(...machineLines, "");
    }

    for (const section of namedSections) {
      const named = machine[section] as Record<string, unknown> | undefined;

      if (named !== undefined) {
        lines.push(`${section.padEnd(10)} ${Object.keys(named).length}`);
      }
    }

    lines.push("");

    return `${lines.join("\n")}\n`;
  }

  /** The machine in one line, when there is anything of it to say. */
  private system(machine: ReadMachine): string | undefined {
    const named = [machine.os?.display?.pretty ?? machine.os?.name, machine.arch]
      .filter(Boolean)
      .join(" ");

    if (!named && !machine.os?.kernel) {
      return undefined;
    }

    return machine.os?.kernel ? `${named}, kernel ${machine.os.kernel}`.trim() : named;
  }

  /** The account the reading ran as, which is always in `users` under its own name. */
  private readingAccount(users: Record<string, { name?: string }> | undefined): string {
    return Object.values(users ?? {})[0]?.name ?? "unknown";
  }

  private gigabytes(bytes: number | undefined): string {
    return bytes === undefined ? "unknown" : `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  }
}
