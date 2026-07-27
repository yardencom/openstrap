import { parseAssignments, versionIn, type Inventory, type ToolFact } from "../Inventory.js";
import type { OperatingSystem } from "../OperatingSystem.js";
import type { Shell } from "../Shell.js";

/**
 * The tools almost every blueprint asks about.
 *
 * A caller that cares about something else says so; a caller that does not
 * should not have to spell out the obvious.
 */
const commonTools: readonly string[] = ["node", "npm", "python3", "git"];

/** A tool is named to the shell, so its name has to be a single command word. */
const commandWord = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;

export class UnreadableToolNameError extends Error {
  constructor(name: string) {
    super(`openstrap can only look for a tool named as a single command word, not "${name}"`);
    this.name = "UnreadableToolNameError";
  }
}

/**
 * Which of the tools we were asked about are installed on a target.
 *
 * The question is asked per tool because that is how it is answered: a tool is
 * either on the path or it is not, and one missing tool says nothing about the
 * others. Absence is therefore a fact — `status: "absent"` — and never an
 * error; only a shell that cannot answer at all is an error.
 */
export class ToolInventory implements Inventory {
  readonly section = "tools";

  private readonly names: readonly string[];

  constructor(names: readonly string[] = commonTools) {
    for (const name of names) {
      if (!commandWord.test(name)) {
        throw new UnreadableToolNameError(name);
      }
    }

    this.names = [...names];
  }

  /**
   * Reads every tool asked for, keyed by the name it was asked for by.
   *
   * `_operatingSystem` is accepted because the interface offers it and unused
   * because nothing here varies: `command -v` and `--version` are questions for
   * a shell, and the answer does not depend on whose shell it is.
   */
  async collect(shell: Shell, _operatingSystem: OperatingSystem): Promise<Record<string, ToolFact>> {
    const facts = await Promise.all(this.names.map(async (name) => [name, await this.read(shell, name)] as const));

    return Object.fromEntries(facts);
  }

  private async read(shell: Shell, name: string): Promise<ToolFact> {
    const reported = parseAssignments(await shell.run(this.reading(name)));
    const path = reported.get("path");

    if (!path) {
      return { status: "absent", type: name, executable: false, ready: false };
    }

    return {
      status: "present",
      type: name,
      executable: true,
      ready: true,
      path,
      version: versionIn(reported.get("version") ?? null),
    };
  }

  /**
   * Where the tool is and what it calls itself, in one round trip.
   *
   * A tool that is not installed leaves the script with nothing to print and an
   * exit status of zero, so `shell.run` can be used: not being installed is an
   * answer, but a shell that will not run at all is a fault and must be heard.
   */
  private reading(name: string): string {
    return [
      `path=$(command -v ${name} 2>/dev/null) || exit 0`,
      `printf 'path=%s\\n' "$path"`,
      `printf 'version=%s\\n' "$(${name} --version 2>&1)"`,
    ].join("; ");
  }
}
