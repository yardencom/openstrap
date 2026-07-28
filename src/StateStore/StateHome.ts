import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Where openstrap keeps what is true of this machine only.
 *
 * Reserved ports, provider resource ids, runs and secret references live here rather
 * than in the repository, because none of them is the same for the next person who
 * clones it. `XDG_STATE_HOME` is honoured because that is where a Unix system says
 * state belongs, and `OPENSTRAP_STATE_HOME` overrides both so a test never writes into
 * the machine it runs on.
 */
export class StateHome {
  readonly path: string;

  constructor() {
    this.path = process.env.OPENSTRAP_STATE_HOME
      ?? join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"), "openstrap");
  }

  /** Makes sure the directory is there, and says where the state database is. */
  database(): string {
    mkdirSync(this.path, { recursive: true });

    return join(this.path, "state.db");
  }

  /** Where run locks are taken, beside the state they protect. */
  locks(): string {
    mkdirSync(this.path, { recursive: true });

    return join(this.path, "locks");
  }
}
