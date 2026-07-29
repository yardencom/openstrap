import si from "systeminformation";

import type { ProcessDeclaration } from "../../types/FactDeclaration.js";
import type { ProcessFact } from "../../types/FactModel.js";
import type { Platform } from "../platform/Platform.js";

/**
 * What is running on this machine.
 *
 * The table and the processes a caller named live in one section because both are facts about the
 * same machine. Every declared name is answered, present or absent: a name that produced no entry
 * would be indistinguishable from a name nobody asked about, so absence is a value and never a gap.
 */
export class ProcessFacts {
  constructor(private readonly platform: Platform) {}

  /**
   * The process table, plus an answer for every process the caller named.
   *
   * Both live in one section because both are facts about the same machine. The
   * table is keyed by `pid-<pid>`, which is the identity a process actually has;
   * a declared process is keyed by the name the caller gave it, because that is
   * what the caller will look for.
   */
  async processes(declared: Record<string, ProcessDeclaration> | undefined): Promise<Record<string, ProcessFact>> {
    if (declared === undefined) {
      return {};
    }

    const running = await si.processes();
    const table: Record<string, ProcessFact> = {};

    for (const entry of running.list) {
      table[`pid-${entry.pid}`] = {
        status: "present",
        pid: entry.pid,
        ppid: entry.parentPid,
        name: entry.name,
        user: entry.user,
        state: entry.state,
        command: entry.path ? `${entry.path}/${entry.name}` : entry.name,
        args: entry.params || undefined,
        startedAt: entry.started || undefined,
      };
    }

    for (const [id, declaration] of Object.entries(declared)) {
      table[id] = this.platform.matches(declaration.platforms)
        ? this.declaredProcess(declaration, id, running.list)
        : { status: "unsupported", reason: "platform_not_selected" };
    }

    return table;
  }

  /**
   * The processes a declaration matches.
   *
   * Every match is reported, because "is node running" and "how many node
   * processes are there" are the same question asked twice, and the first pid is
   * kept as well so a caller that expects one process does not have to unpack a
   * list.
   */
  private declaredProcess(
    declaration: ProcessDeclaration,
    id: string,
    running: readonly si.Systeminformation.ProcessesProcessData[],
  ): ProcessFact {
    const wantedName = declaration.name ?? (declaration.command === undefined ? id : undefined);
    const matches = running.filter((entry) => {
      if (wantedName !== undefined && !mentions(entry.name, wantedName)) {
        return false;
      }

      if (declaration.command !== undefined && !mentions(entry.name, declaration.command) && !entry.params.includes(declaration.command)) {
        return false;
      }

      return true;
    });
    const [first] = matches;

    if (!first) {
      return { status: "absent", name: wantedName ?? declaration.command, pids: [] };
    }

    return {
      status: "present",
      pids: matches.map((entry) => entry.pid),
      pid: first.pid,
      ppid: first.parentPid,
      name: first.name,
      user: first.user,
      state: first.state,
      command: first.path ? `${first.path}/${first.name}` : first.name,
    };
  }
}

/** A process is named by its executable, so `sshd` and `sshd.exe` are the same one. */
function mentions(reported: string, wanted: string): boolean {
  const name = reported.toLowerCase().endsWith(".exe") ? reported.slice(0, -4) : reported;

  return name === wanted || name.split("/").pop() === wanted;
}
