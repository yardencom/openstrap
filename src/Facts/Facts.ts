import { createFactCollection } from "./Domain/FactCollectionFactory.js";
import type { FactCollectionItem } from "./Domain/Facts.js";

export class Facts extends Array<FactCollectionItem> {
  constructor(items: readonly FactCollectionItem[]) {
    super();

    if (Array.isArray(items)) {
      this.push(...createFactCollection(items));
    }
  }
}
