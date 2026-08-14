import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Where openstrap keeps what is true of this machine only. */
export class StateHome {
  readonly path: string;

  /** @param environment Taken rather than read, so a test can be given a directory of its own. */
  constructor(environment: NodeJS.ProcessEnv = process.env) {
    this.path = environment.OPENSTRAP_STATE_HOME
      ?? join(environment.XDG_STATE_HOME ?? join(homedir(), ".local", "state"), "openstrap");
  }

  /** Makes sure the directory is there, and says where the state database is. */
  database(): string {
    mkdirSync(this.path, { recursive: true });

    return join(this.path, "state.db");
  }

  locks(): string {
    mkdirSync(this.path, { recursive: true });

    return join(this.path, "locks");
  }
}
