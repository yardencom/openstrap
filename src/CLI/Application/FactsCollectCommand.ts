import { join } from "node:path";

import { JsonFileExporter } from "../../Export/index.js";
import { Facts } from "../../Facts/Facts.js";

type CollectedFacts = Awaited<ReturnType<Facts["collect"]>>;

export type FactsCollectResult = CollectedFacts & {
  storage: {
    runDirectory: string;
    resultPath: string;
  };
};

export type FactsCollectRequest = {
  path: string;
  workspaceRoot: string;
  inputs: Record<string, string>;
  now?: Date;
};

/**
 * `openstrap facts collect` — read this machine the way a definition file says to.
 *
 * Two steps and no logic of its own: the facts module answers an order that names
 * the definition, and the answer is written where a run keeps its artifacts. The
 * command owns the second step only because where a run's files live is a property
 * of the workspace rather than of the facts.
 */
export async function collectFactsFromDefinition(request: FactsCollectRequest): Promise<FactsCollectResult> {
  const collected = await new Facts().collect({
    target: {
      name: "host",
      scope: "host",
      type: "host",
      displayName: "Local host",
      transport: "local",
    },
    definition: {
      path: request.path,
      inputs: request.inputs,
      workspaceRoot: request.workspaceRoot,
    },
    now: request.now,
  });
  const runDirectory = join(request.workspaceRoot, ".openstrap", "runs", "facts", collected.facts[0]!.run.id);
  const result: FactsCollectResult = {
    ...collected,
    storage: {
      runDirectory,
      resultPath: join(runDirectory, "result.json"),
    },
  };

  new JsonFileExporter().write({ resultPath: result.storage.resultPath, payload: result });

  return result;
}
