import { Facts, everySection, type FactSnapshot } from "../../Modules/Facts/Facts.js";
import type { FactsCollectArgs } from "../arguments/types.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";

/**
 * What the command answers with: the snapshot, and nothing wrapped around it.
 *
 * Not `{ snapshot }`. A wrapper of one field is a wrapper a reader has to know about, and one reader
 * is openstrap itself — asked for facts on a machine it delivered itself to, it wants the snapshot,
 * not an envelope.
 */
export type FactsCollectResult = FactSnapshot;

/**
 * `openstrap facts collect` — read this machine and say what is on it.
 *
 * Asking openstrap for the facts is asking for the facts, so the order names every section there is.
 * Nothing is measured against anything: requirements and everything else a blueprint intends are
 * deliberately absent — `openstrap run` is the command that compares, and this one only looks. The
 * sections that hold named things come back empty, because nothing on a machine can list every
 * service or every program on it and openstrap does not invent names to fill them with.
 *
 * The machine is called `host`, which is what openstrap calls the machine it is running on when
 * nobody has called it anything else. A run takes the name from the blueprint instead.
 *
 * Nothing is written. A run keeps its snapshots in the state store; this command used to also drop a
 * `result.json` under `.openstrap/runs/facts/`, which was a second store for the same thing. It has to
 * write nothing anyway, because this is the command openstrap runs on a machine it was only asked to
 * read, where a working directory of its own is not something it has.
 */
export class FactsCollectCommand implements CliCommand<FactsCollectArgs, FactsCollectResult> {
  async execute(args: FactsCollectArgs, context: CommandContext): Promise<CommandOutcome<FactsCollectResult>> {
    const snapshot = await Facts.collect(args.order ?? {
      target: { name: "host", scope: "host", type: "host", displayName: "Local host" },
      declare: everySection,
      now: context.now,
    });

    return {
      result: snapshot,
      // A machine that could not be read at all throws; a reading that came back with a failed
      // section is still a result, and the caller has to be able to notice.
      exitCode: snapshot.reading.status === "error" ? 1 : 0,
    };
  }
}
