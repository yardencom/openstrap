import { join } from "node:path";

import { JsonFileExporter } from "../../Export/index.js";
import { Facts } from "../../Modules/Facts/Facts.js";
import type { FactsCollectArgs } from "../Arguments/types.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";

type FactCollection = Awaited<ReturnType<Facts["collect"]>>;

export type FactsCollectResult = {
  facts: FactCollection;
  storage: {
    runDirectory: string;
    resultPath: string;
  };
};

/**
 * `openstrap facts collect` — read this machine and keep what was found.
 *
 * Nothing is declared, so nothing is asked about by name: this is the machine as it is,
 * not the machine measured against something. Requirements and everything else a
 * blueprint intends are deliberately absent — `openstrap run` is the command that
 * compares, and this one only looks.
 */
export class FactsCollectCommand implements CliCommand<FactsCollectArgs, FactsCollectResult> {
  constructor(private readonly exporter = new JsonFileExporter()) {}

  async execute(_args: FactsCollectArgs, context: CommandContext): Promise<CommandOutcome<FactsCollectResult>> {
    const collected = await this.collect(context);

    return {
      result: collected,
      // A machine that could not be read at all throws; a run that came back with a
      // failed section is still a result, and the caller has to be able to notice.
      exitCode: collected.facts.some((item) => item.run.status === "error") ? 1 : 0,
    };
  }

  /**
   * Reads the machine and writes the result where a run keeps its artifacts.
   *
   * Where that is belongs to the workspace rather than to the facts, which is why the
   * command owns this step and the facts module does not.
   */
  private async collect(context: CommandContext): Promise<FactsCollectResult> {
    const facts = await new Facts().collect({
      target: {
        name: "host",
        scope: "host",
        type: "host",
        displayName: "Local host",
        transport: "local",
      },
      now: context.now,
    });
    const runDirectory = join(context.workspaceRoot, ".openstrap", "runs", "facts", facts[0]!.run.id);
    const result: FactsCollectResult = {
      facts,
      storage: {
        runDirectory,
        resultPath: join(runDirectory, "result.json"),
      },
    };

    this.exporter.write({ resultPath: result.storage.resultPath, payload: result });

    return result;
  }
}
