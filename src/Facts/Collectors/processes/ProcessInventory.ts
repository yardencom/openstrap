import type { Inventory, ProcessFact } from "../Inventory.js";
import type { OperatingSystem, OperatingSystemName } from "../OperatingSystem.js";
import type { Shell } from "../Shell.js";

/**
 * The processes running on a target, keyed by `pid-<pid>`.
 *
 * A requirement asks "is pid 4242 still there", so the answer has to be a map
 * that can be looked up by name. A list would force every caller to scan.
 *
 * The process table is not something a machine can legitimately lack: a target
 * that cannot answer `ps` is a target we failed to read, not a target with no
 * processes. That is why this reads through `shell.run` and lets the failure
 * travel, rather than quietly reporting an empty inventory.
 */
export class ProcessInventory implements Inventory {
  readonly section = "processes";

  /** How each operating system is asked for its process table. */
  private static readonly listings: Record<OperatingSystemName, string> = {
    linux: "ps -axo pid=,ppid=,user=,state=,args=",
    darwin: "ps -axo pid=,ppid=,user=,state=,args=",
    windows: "wmic process get ProcessId,ParentProcessId,Name,CommandLine /format:csv",
  };

  async collect(shell: Shell, operatingSystem: OperatingSystem): Promise<Record<string, ProcessFact>> {
    const listing = await shell.run(operatingSystem.select(ProcessInventory.listings));
    const read = operatingSystem.select({
      linux: (line: string) => this.posixEntry(line),
      darwin: (line: string) => this.posixEntry(line),
      windows: (line: string) => this.windowsEntry(line),
    });
    const processes: Record<string, ProcessFact> = {};

    for (const line of listing.split("\n").map((candidate) => candidate.trim()).filter(Boolean)) {
      const entry = read(line);

      if (entry) {
        processes[`pid-${entry.pid}`] = entry;
      }
    }

    return processes;
  }

  /**
   * `ps -axo pid=,ppid=,user=,state=,args=` — one process per line.
   *
   * `comm=` is deliberately absent. BSD ps truncates it to sixteen characters
   * unless it is the final column, which silently turns
   * `/System/Library/CoreServices/…` into `/System/Library/` and makes a
   * process asked for by name unfindable. The name is taken from argv[0]
   * instead, which `args=` gives in full.
   */
  private posixEntry(line: string): ProcessFact | undefined {
    const match = line.match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.*)$/);

    if (!match) {
      return undefined;
    }

    const [, pid, ppid, user, state, args] = match;
    const command = (args ?? "").split(/\s+/)[0] ?? "";

    return {
      status: "present",
      pid: Number(pid),
      ppid: Number(ppid),
      user,
      state,
      name: this.withoutExecutableExtension(command),
      command,
      args: args ?? command,
    };
  }

  /** `wmic ... /format:csv` — `Node,CommandLine,Name,ParentProcessId,ProcessId`. */
  private windowsEntry(line: string): ProcessFact | undefined {
    if (line.startsWith("Node,")) {
      return undefined;
    }

    const parts = line.split(",");
    const command = parts[1] ?? "";
    const name = parts[2] ?? "";
    const ppid = Number(parts[3]);
    const pid = Number(parts[4]);

    if (!pid) {
      return undefined;
    }

    return {
      status: "present",
      pid,
      ppid: Number.isFinite(ppid) ? ppid : undefined,
      name: this.withoutExecutableExtension(name),
      command: command || name || String(pid),
      args: command || name || String(pid),
    };
  }

  /** `sshd` and `sshd.exe` are the same process to anyone asking by name. */
  private withoutExecutableExtension(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    return value.toLowerCase().endsWith(".exe") ? value.slice(0, -4) : value;
  }
}
