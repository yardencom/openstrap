import { resolve } from "node:path";

import { createFactCollection } from "../../Domain/FactCollectionFactory.js";
import type { FactCollectionRequest } from "../../Domain/FactCollectionRequest.js";
import type {
  FactCollection,
  FactCollectionItem,
} from "../../Domain/Facts.js";
import { stableFactId } from "./FactIds.js";
import { collectSystemFactsForScope } from "./SystemFacts.js";

const schemaVersion = "facts.v1";

export class SystemSnapshot {
  collect(params: FactCollectionRequest): FactCollection {
    const now = params.now ?? new Date();
    const timestamp = now.toISOString();
    const workspaceRoot = resolve(params.workspaceRoot ?? process.cwd());
    const items = params.targets.map((request): FactCollectionItem => {
      const target = request.target;
      const snapshotId = stableFactId("snap", target.name, timestamp);
      const runId = stableFactId("fact_run", target.name, timestamp);

      return {
        snapshot: {
          id: snapshotId,
          schemaVersion,
          scope: target.scope,
          target: {
            type: target.type,
            id: target.name,
            displayName: target.displayName,
          },
          data: collectSystemFactsForScope(target.scope, workspaceRoot, request.selectors),
        },
        run: {
          id: runId,
          snapshotId,
          startedAt: timestamp,
          finishedAt: timestamp,
          status: "success",
          attempt: params.attempt ?? 1,
        },
      };
    });

    return createFactCollection(items);
  }
}
