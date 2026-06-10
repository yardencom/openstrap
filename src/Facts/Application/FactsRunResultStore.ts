import { join } from "node:path";

import { JsonFileExporter } from "../../Export/index.js";
import type { CollectFactsFromDefinitionResult } from "./CollectFactsFromDefinition.js";

export type FactsResultStorage = {
  runDirectory: string;
  resultPath: string;
};

export type StoredCollectFactsFromDefinitionResult = CollectFactsFromDefinitionResult & {
  storage: FactsResultStorage;
};

export type StoreCollectedFactsRequest = {
  workspaceRoot: string;
  result: CollectFactsFromDefinitionResult;
};

export class FactsRunResultStore {
  constructor(private readonly jsonFileExporter = new JsonFileExporter()) {}

  storeCollectedFacts(request: StoreCollectedFactsRequest): StoredCollectFactsFromDefinitionResult {
    const item = request.result.facts[0];

    if (!item) {
      throw new Error("Collected facts result must contain at least one fact item");
    }

    const runDirectory = join(request.workspaceRoot, ".openstrap", "runs", "facts", item.run.id);
    const resultPath = join(runDirectory, "result.json");
    const storedResult = {
      ...request.result,
      storage: {
        runDirectory,
        resultPath,
      },
    };

    this.jsonFileExporter.write({
      resultPath,
      payload: storedResult,
    });

    return storedResult;
  }
}
