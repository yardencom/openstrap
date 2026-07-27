import type { Transport } from "../../../Transport/index.js";
import { SystemCollector } from "../../Collectors/SystemCollector.js";
import { createFactCollection } from "../../Domain/FactCollectionFactory.js";
import type { FactCollectionRequest } from "../../Domain/FactCollectionRequest.js";
import type { FactCollection } from "../../Domain/Facts.js";

/**
 * Facts about any target, collected through a transport.
 *
 * The same class serves the host and a guest. The host is reached over the
 * local transport, a guest over SSH, and neither knows the difference —
 * which is the point: collection varies by the operating system of the
 * target, not by how it is reached.
 */
export class TargetFacts {
  private readonly collector: SystemCollector;

  constructor(transport: Transport) {
    this.collector = new SystemCollector(transport);
  }

  async collect(request: FactCollectionRequest): Promise<FactCollection> {
    const startedAt = (request.now ?? new Date()).toISOString();
    const stamp = startedAt.replace(/[-:.]/g, "");
    const items = [];

    for (const targetRequest of request.targets) {
      const target = targetRequest.target;
      const data = await this.collector.collect();
      const snapshotId = `snap_${target.name}_${stamp}`;

      items.push({
        snapshot: {
          id: snapshotId,
          schemaVersion: "facts.v1",
          scope: target.scope,
          target: { type: target.type, id: target.name, displayName: target.displayName },
          data,
        },
        run: {
          id: `fact_run_${target.name}_${stamp}`,
          snapshotId,
          startedAt,
          finishedAt: new Date().toISOString(),
          status: "success" as const,
          attempt: request.attempt ?? 1,
        },
      });
    }

    return createFactCollection(items);
  }
}
