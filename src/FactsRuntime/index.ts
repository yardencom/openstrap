export {
  createFactCollection,
  FactCollectionValidationError,
} from "./Domain/FactCollectionFactory.js";
export { LocalProcessFactCollector } from "./Adapters/LocalProcessFactCollector.js";
export type {
  BaseSystem,
  FactCollection,
  FactCollectionItem,
  FactCollectionTarget,
  FactRun,
  FactRunStatus,
  FactScope,
  FactSnapshot,
  FactTarget,
  GuestSystem,
  HostSystem,
  Network,
  NormalizedFactData,
  Observed,
  ObservedStatus,
  PathFact,
  RuntimeFact,
  ToolFact,
  Transport,
} from "./Domain/Facts.js";
