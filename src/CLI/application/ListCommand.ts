import { WhereMachinesAreRecorded } from "./WhereMachinesAreRecorded.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";
import type { ListArgs } from "../arguments/types.js";
import type { OpenStrapRuntime } from "../../Plugin/index.js";

/**
 * What is known about a machine, and what it is doing.
 *
 * The first half is remembered — it was written down when the machine was made. The second is not
 * and cannot be: whether a machine runs is true on the hypervisor holding it, so it is asked at the
 * moment of asking (ADR 0005). A stored status is a guess with a timestamp on it.
 */
export type ListedMachine = {
  name: string;
  provider?: string;
  transport?: string;
  image?: { reference: string; sha256?: string };
  /** Where it was made, where anything says so: a laptop's vm is not a machine anyone else can reach. */
  host?: string;
  /**
   * As the provider reports it now.
   *
   * `missing` means the provider has no machine by that name any more — it was deleted behind
   * openstrap's back, and the record outlived it. `unreachable` means the provider that holds it is
   * not on this computer, which is the ordinary answer for a colleague's laptop.
   */
  status: "running" | "stopped" | "suspended" | "unknown" | "missing" | "unreachable";
  detail?: string;
};

export type ListResult = {
  machines: readonly ListedMachine[];
  /** Which record answered, so a short list is not mistaken for an empty world. */
  from: "server" | "here";
};

/** `openstrap list` — every machine that is known, and what each is doing right now. */
export class ListCommand implements CliCommand<ListArgs, ListResult> {
  constructor(
    private readonly open = (runtime: OpenStrapRuntime, local: boolean) =>
      WhereMachinesAreRecorded.of(runtime, local),
  ) {}

  async execute(args: ListArgs, context: CommandContext): Promise<CommandOutcome<ListResult>> {
    const runtime = await context.runtime();
    const recorded = await this.open(runtime, args.local);

    try {
      // Both records, not one of them. Where a run is written down is a question about that run;
      // which machines exist is not, and a machine made here before this laptop joined a server is
      // still a machine somebody can go and look at.
      const here = recorded.local.machines.list().filter(ListCommand.isAMachine).map((machine) => ({
        name: machine.name,
        provider: machine.provider,
        transport: machine.transport,
        image: ListCommand.pinOf(recorded.local, machine.name),
        host: undefined,
      }));
      const there = recorded.server
        ? (await recorded.server.targets()).filter(ListCommand.isAMachine).map((summary) => ({
          name: summary.name,
          provider: summary.provider,
          transport: summary.transport,
          image: summary.image,
          host: summary.host,
        }))
        : [];
      // The server's answer wins where both know a name: it is the record, and this file is what
      // was written here before there was one.
      const known = [...there, ...here.filter((machine) => !there.some((one) => one.name === machine.name))];
      const machines = await Promise.all(known.map((machine) => ListCommand.asked(machine, runtime)));

      return {
        result: { machines, from: recorded.server ? "server" : "here" },
        exitCode: 0,
      };
    } finally {
      recorded.close();
    }
  }

  /** The machine as the provider holding it reports it, or why it could not be asked. */
  /**
   * A machine, as against the computer the question is being asked on.
   *
   * A blueprint can declare the host — openstrap reads it and brings it to what is written — and that
   * is recorded like anything else. It is not a machine anybody made, holds, or could lose, so a list
   * of machines that included it would be answering a question nobody asked.
   */
  private static isAMachine(recorded: { scope: string }): boolean {
    return recorded.scope !== "host";
  }

  private static async asked(
    listed: Omit<ListedMachine, "status" | "detail">,
    runtime: OpenStrapRuntime,
  ): Promise<ListedMachine> {
    const machine = listed;

    if (machine.provider === undefined) {
      return { ...listed, status: "unreachable", detail: "nothing recorded which provider holds it" };
    }

    const provider = runtime.providers.get(machine.provider);

    if (provider === undefined) {
      return { ...listed, status: "unreachable", detail: `no ${machine.provider} plugin on this computer` };
    }

    try {
      const handle = await provider.find(machine.name);

      return handle === null
        ? { ...listed, status: "missing", detail: `${machine.provider} has no machine by that name` }
        : { ...listed, status: (await provider.inspect(handle)).status };
    } catch (error) {
      return { ...listed, status: "unreachable", detail: error instanceof Error ? error.message : String(error) };
    }
  }

  private static pinOf(store: WhereMachinesAreRecorded["local"], name: string) {
    const pinned = store.machines.pinOf(name);

    return pinned === null ? undefined : { reference: pinned.reference, sha256: pinned.sha256 };
  }
}
