import { HostFacts } from "../Adapters/Local/HostFacts.js";
import type { FactCollectionRequest } from "../Domain/FactCollectionRequest.js";
import type { FactCollection } from "../Domain/Facts.js";
import { Facts } from "../Facts.js";

type FactCollectionCollector = {
  collect(request: FactCollectionRequest): FactCollection | Promise<FactCollection>;
};

export class CollectFacts {
  constructor(private readonly collector: FactCollectionCollector = new HostFacts()) {}

  async collect(request: FactCollectionRequest): Promise<Facts> {
    const items = await Promise.resolve(this.collector.collect(request));

    return new Facts(items);
  }
}
