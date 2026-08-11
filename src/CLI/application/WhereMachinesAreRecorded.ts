import { OpenStrapServer } from "../../Server/index.js";
import { SqliteStateStore, StateHome } from "../../StateStore/index.js";

/**
 * Where the machines of this run are written down, and where they are looked for.
 *
 * One machine lives in one place. A run told about a server writes there and reads there, because a
 * machine an organization has is the organization's to know about; a run told about none writes here,
 * because a hypervisor on a laptop is answerable to nobody else.
 *
 * Both at once was considered and is the one thing this must not be: two records of the same machine
 * drift, and then there is no way to say which of them is the machine.
 */
export class WhereMachinesAreRecorded {
  readonly server: OpenStrapServer | undefined;
  readonly store: SqliteStateStore | undefined;

  constructor(stateHome = new StateHome(), environment = process.env) {
    this.server = OpenStrapServer.fromEnvironment(environment);
    this.store = this.server ? undefined : new SqliteStateStore(stateHome.database());
  }

  close(): void {
    this.store?.close();
  }
}
