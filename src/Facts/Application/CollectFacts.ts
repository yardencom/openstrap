import { HostFacts } from "../Adapters/Local/HostFacts.js";
import type { FactCollectionRequest } from "../Domain/FactCollectionRequest.js";
import type { FactCollectionItem } from "../Domain/Facts.js";
import { Facts } from "../Facts.js";

type FactCollectionCollector = {
  collect(request: FactCollectionRequest): Promise<readonly FactCollectionItem[]>;
};

export class CollectFacts {
  constructor(private readonly collector: FactCollectionCollector = new HostFacts()) {}

  async collect(request: FactCollectionRequest): Promise<Facts> {
    return new Facts(await this.collector.collect(request));
  }
}
