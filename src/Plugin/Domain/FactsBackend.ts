export type FactsBackendSection =
  | "os"
  | "arch"
  | "cpu"
  | "memory"
  | "storage"
  | "network"
  | "users"
  | "packages"
  | "processes"
  | "services"
  | "transports"
  | "privileges"
  | "runtimes"
  | "paths"
  | "tools"
  | "env";

export type FactsBackendCollectionTarget = {
  name: string;
  scope: string;
  type: string;
  displayName?: string;
  transport: string;
};

export type FactsBackendSelectorTree = Record<string, unknown>;

export type FactsBackendTargetCollectionRequest = {
  target: FactsBackendCollectionTarget;
  selectors: FactsBackendSelectorTree;
};

export type FactsBackendCollectionRequest = {
  targets: readonly FactsBackendTargetCollectionRequest[];
  workspaceRoot?: string;
  now?: Date;
  attempt?: number;
};

export type FactsBackendCollectionItem = {
  snapshot: {
    id: string;
    schemaVersion: string;
    scope: string;
    target: {
      type: string;
      id: string;
      displayName?: string;
    };
    data: any;
  };
  run: {
    id: string;
    snapshotId: string;
    startedAt: string;
    finishedAt: string;
    status: "success" | "warning" | "error";
    validUntil?: string;
    ttl?: string;
    attempt?: number;
  };
};

export type FactsBackendCollection = readonly FactsBackendCollectionItem[];

export type FactsBackendCapabilities = {
  scopes: readonly string[];
  transports: readonly string[];
  sections: readonly FactsBackendSection[];
};

export type FactsBackend = {
  id: string;
  displayName?: string;
  capabilities: FactsBackendCapabilities;
  collect(request: FactsBackendCollectionRequest): FactsBackendCollection;
};
