import { Facts, type FactOrder } from "../../Modules/Facts/Facts.js";
import type { FactsCollectArgs } from "../arguments/types.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";

/**
 * What the command answers with: the snapshot, and nothing wrapped around it.
 *
 * Not `{ snapshot }`. A wrapper of one field is a wrapper a reader has to know about, and one reader
 * is openstrap itself — asked for facts on a machine it delivered itself to, it wants the snapshot,
 * not an envelope.
 */
export type FactsCollectResult = Awaited<ReturnType<Facts["collect"]>>;

/**
 * `openstrap facts collect` — read this machine and say what is on it.
 *
 * Nothing is declared unless the caller says so, so nothing is asked about by name: this is the
 * machine as it is, not the machine measured against something. Requirements and everything else a
 * blueprint intends are deliberately absent — `openstrap run` is the command that compares, and this
 * one only looks.
 *
 * Nothing is written. A run keeps its snapshots in the state store; this command used to also drop a
 * `result.json` under `.openstrap/runs/facts/`, which was a second store for the same thing. It has to
 * write nothing anyway, because this is the command openstrap runs on a machine it was only asked to
 * read, where a working directory of its own is not something it has.
 */
export class FactsCollectCommand implements CliCommand<FactsCollectArgs, FactsCollectResult> {
  async execute(args: FactsCollectArgs, context: CommandContext): Promise<CommandOutcome<FactsCollectResult>> {
    const snapshot = await new Facts().collect(args.order ?? thisMachine(context.now));

    return {
      result: snapshot,
      // A machine that could not be read at all throws; a reading that came back with a failed
      // section is still a result, and the caller has to be able to notice.
      exitCode: snapshot.reading.status === "error" ? 1 : 0,
    };
  }
}

/** What to read when nobody said: this machine, all of it, reached by no channel. */
function thisMachine(now: Date | undefined): FactOrder {
  return {
    target: { name: "host", scope: "host", type: "host", displayName: "Local host" },
    now,
  };
}
