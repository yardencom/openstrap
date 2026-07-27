import type { Inventory, PathFact } from "../Inventory.js";
import { parseAssignments } from "../Inventory.js";
import type { OperatingSystem } from "../OperatingSystem.js";
import type { Shell } from "../Shell.js";

/**
 * A configured path written the way the target's shell should read it.
 *
 * A leading `$HOME` or `~` is handed to the shell rather than expanded here.
 * The home directory that matters belongs to the account the transport reaches,
 * and the process running openstrap may be a different account on a different
 * machine; expanding in JavaScript would answer about the host every time.
 *
 * Everything that is not that prefix is single quoted, so a path containing a
 * space, an apostrophe or a `$` arrives at `test` as one literal word.
 */
class ShellPath {
  constructor(private readonly configured: string) {}

  /** One shell word: `'/tmp'`, or `"$HOME"'/.config'`. */
  get word(): string {
    const remainder = this.beneathHome();

    if (remainder === null) {
      return this.quoted(this.configured);
    }

    return remainder === "" ? '"$HOME"' : `"$HOME"${this.quoted(remainder)}`;
  }

  /**
   * What follows the home prefix, or null when there is no home prefix.
   *
   * Only a leading prefix counts. A `$HOME` further along is part of a file
   * name, and a target is entitled to have one.
   */
  private beneathHome(): string | null {
    for (const prefix of ["$HOME", "~"]) {
      if (this.configured === prefix) {
        return "";
      }

      if (this.configured.startsWith(`${prefix}/`)) {
        return this.configured.slice(prefix.length);
      }
    }

    return null;
  }

  private quoted(literal: string): string {
    return `'${literal.split("'").join(`'\\''`)}'`;
  }
}

/**
 * What is at each path a blueprint cares about, keyed by the name it gave them.
 *
 * The paths arrive named — `{ home: "$HOME" }` — and the facts come back under
 * those same names: a requirement asks "is `home` writable", never "is
 * `/Users/ada` writable". The expanded path travels inside the fact, so the
 * caller can still see which path was actually inspected.
 *
 * A path that is not there is an answer, not a fault, so absence is reported as
 * `status: "absent"`. A target that cannot answer the question at all is a
 * fault, which is why the questions go out through `shell.run`: a broken
 * connection must not read back as an empty directory tree.
 */
export class PathInventory implements Inventory {
  readonly section = "paths";

  constructor(private readonly paths: Readonly<Record<string, string>>) {}

  /**
   * One script, one round trip, however many paths were asked about.
   *
   * The operating system is taken because every inventory is called the same
   * way, and then ignored: `test` gives the same answers everywhere openstrap
   * reaches, so there is genuinely nothing here to select.
   */
  async collect(shell: Shell, _operatingSystem?: OperatingSystem): Promise<Record<string, PathFact>> {
    const named = Object.entries(this.paths);
    const script = named.map(([, path], index) => this.probe(index, path)).join("\n");
    const readings = parseAssignments(await shell.run(script));
    const facts: Record<string, PathFact> = {};

    named.forEach(([name, path], index) => {
      facts[name] = this.fact(readings, index, path);
    });

    return facts;
  }

  /**
   * Every question about one path, tagged by position.
   *
   * Position rather than the logical name: the name comes from a blueprint and
   * may hold anything, including the `=` and the newline this listing is made
   * of.
   */
  private probe(index: number, path: string): string {
    return [
      `p=${new ShellPath(path).word}`,
      `printf '${index}.path=%s\\n' "$p"`,
      // A dangling symlink fails `-e` and passes `-L`. The entry is there; only
      // its target is missing, and calling that "absent" would hide a broken
      // link behind a fact that reads like an empty spot on the disk.
      this.yesOrNo(index, "exists", '[ -e "$p" ] || [ -L "$p" ]'),
      this.kind(index),
      this.yesOrNo(index, "readable", '[ -r "$p" ]'),
      this.yesOrNo(index, "writable", '[ -w "$p" ]'),
      this.yesOrNo(index, "executable", '[ -x "$p" ]'),
    ].join("\n");
  }

  /** A reading that always answers, so a "no" never fails the script. */
  private yesOrNo(index: number, field: string, test: string): string {
    return `if ${test}; then printf '${index}.${field}=yes\\n'; else printf '${index}.${field}=no\\n'; fi`;
  }

  /**
   * `-d` and `-f` follow the link, so a symlink to a directory reads as the
   * directory it points at — which is what anyone asking "is my cache
   * directory there" means. `symlink` is left for the links that resolve to
   * nothing.
   */
  private kind(index: number): string {
    return [
      `if [ -d "$p" ]; then printf '${index}.type=directory\\n'`,
      `elif [ -f "$p" ]; then printf '${index}.type=file\\n'`,
      `elif [ -L "$p" ]; then printf '${index}.type=symlink\\n'`,
      `elif [ -e "$p" ]; then printf '${index}.type=other\\n'`,
      "else :",
      "fi",
    ].join("; ");
  }

  private fact(readings: Map<string, string>, index: number, configured: string): PathFact {
    const exists = this.reading(readings, index, "exists", configured) === "yes";
    const fact: PathFact = {
      status: exists ? "present" : "absent",
      path: readings.get(`${index}.path`) ?? configured,
      exists,
      readable: this.reading(readings, index, "readable", configured) === "yes",
      writable: this.reading(readings, index, "writable", configured) === "yes",
      executable: this.reading(readings, index, "executable", configured) === "yes",
    };

    if (exists) {
      fact.type = this.type(readings.get(`${index}.type`));
    }

    return fact;
  }

  /** A question the target left unanswered is a fault, not a missing path. */
  private reading(readings: Map<string, string>, index: number, field: string, path: string): string {
    const value = readings.get(`${index}.${field}`);

    if (value === undefined) {
      throw new Error(`The target did not report "${field}" for ${path}`);
    }

    return value;
  }

  private type(reported: string | undefined): PathFact["type"] {
    switch (reported) {
      case "directory":
      case "file":
      case "symlink":
        return reported;
      default:
        return "other";
    }
  }
}
