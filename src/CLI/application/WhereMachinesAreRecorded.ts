import { CarryLocalRuns } from "./CarryLocalRuns.js";
import type { OpenStrapRuntime } from "../../Plugin/index.js";
import { OpenStrapServer } from "../../Api/index.js";
import { Store, StateHome } from "../../Store/index.js";
import { hostname } from "node:os";

/**
 * Where the machines of this run are written down, and where they are looked for.
 *
 * One machine lives in one place. A run told about a server writes there and reads there, because a
 * machine an organization has is the organization's to know about; a run told about none writes to
 * `local`, because a hypervisor on a laptop is answerable to nobody else.
 *
 * Both at once was considered and is the one thing this must not be: two records of the same machine
 * drift, and then there is no way to say which of them is the machine. Which is why `store` is the
 * place to write and is absent whenever a server is there, while `local` is the file on this disk and
 * is always open — a run made here before any server existed still has to be able to leave.
 */
export class WhereMachinesAreRecorded {
  /**
   * Opened rather than constructed, because reaching the token is asking a plugin, and asking a
   * plugin is waiting for it.
   */
  static async of(runtime: OpenStrapRuntime, local = false): Promise<WhereMachinesAreRecorded> {
    return new WhereMachinesAreRecorded(
      local ? undefined : await OpenStrapServer.of(runtime.secretStores.soleIfAny()),
    );
  }

  readonly server: OpenStrapServer | undefined;
  /** This machine's own file. Open either way: what happened here has to be readable to be told. */
  readonly local: Store;

  constructor(server?: OpenStrapServer, stateHome = new StateHome()) {
    this.server = server;
    this.local = new Store(stateHome.database());
  }

  /** Where to write. Nothing, when a server is the record. */
  get store(): Store | undefined {
    return this.server ? undefined : this.local;
  }

  /**
   * What happened here while nothing was listening, told to a server that now is.
   *
   * @param runtime Where the provider ids come from: nothing keeps them, so each machine is looked up
   * by name at the moment its run is carried.
   */
  carry(runtime: OpenStrapRuntime, now?: Date): Promise<{ carried: number; failures: readonly string[] }> {
    if (this.server === undefined) {
      return Promise.resolve({ carried: 0, failures: [] });
    }

    return new CarryLocalRuns(
      this.local,
      this.server,
      WhereMachinesAreRecorded.thisHost(),
      async (provider, target) => (await runtime.providers.require(provider).find(target))?.id ?? null,
    ).all(now);
  }

  close(): void {
    this.local.close();
  }

  /** The machine openstrap is running on: a port is only occupied on the host that forwards it. */
  private static thisHost(): { id: string; platform: string; architecture: string } {
    return { id: hostname(), platform: process.platform, architecture: process.arch };
  }
}
