import { SystemInformationFactCollector } from "./Adapters/SystemInformationFactCollector.js";
import type { FactCollectionRequest } from "./Domain/FactCollectionRequest.js";
import type { FactCollection } from "./Domain/Facts.js";

type FactsCollector = {
  collect(request: FactCollectionRequest): FactCollection | Promise<FactCollection>;
};

export class Facts {
  constructor(private readonly collector: FactsCollector = new SystemInformationFactCollector()) {}

  collect(request: FactCollectionRequest): FactCollection | Promise<FactCollection> {
    return this.collector.collect(request);
  }
}
