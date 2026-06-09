import type { FactCollectionTarget } from "./Facts.js";

export type FactSelectorTree = Record<string, unknown>;

export type FactTargetCollectionRequest = {
  target: FactCollectionTarget;
  selectors: FactSelectorTree;
};

export type FactCollectionRequest = {
  targets: readonly FactTargetCollectionRequest[];
  workspaceRoot?: string;
  now?: Date;
  attempt?: number;
};
