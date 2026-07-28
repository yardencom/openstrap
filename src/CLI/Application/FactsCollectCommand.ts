import { join } from "node:path";

import { JsonFileExporter } from "../../Export/index.js";
import { Facts } from "../../Facts/Facts.js";

type FactCollection = Awaited<ReturnType<Facts["collect"]>>;

export type FactsCollectResult = {
  facts: FactCollection;
  storage: {
    runDirectory: string;
    resultPath: string;
  };
};

export type FactsCollectRequest = {
  workspaceRoot: string;
  now?: Date;
};

/**
 * `openstrap facts collect` — read this machine and keep what was found.
 *
 * Nothing is declared, so nothing is asked about by name: this is the machine as it
 * is, not the machine measured against something. Requirements and everything else a
 * blueprint intends are deliberately absent — `openstrap run` is the command that
 * compares, and this one only looks.
 *
 * The command owns where the result lands because that is a property of the
 * workspace rather than of the facts.
 */
export async function collectHostFacts(request: FactsCollectRequest): Promise<FactsCollectResult> {
  const facts = await new Facts().collect({
    target: {
      name: "host",
      scope: "host",
      type: "host",
      displayName: "Local host",
      transport: "local",
    },
    now: request.now,
  });
  const runDirectory = join(request.workspaceRoot, ".openstrap", "runs", "facts", facts[0]!.run.id);
  const result: FactsCollectResult = {
    facts,
    storage: {
      runDirectory,
      resultPath: join(runDirectory, "result.json"),
    },
  };

  new JsonFileExporter().write({ resultPath: result.storage.resultPath, payload: result });

  return result;
}
