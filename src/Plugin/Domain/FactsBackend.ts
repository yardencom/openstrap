import type {
  FactCollection,
  FactCollectionRequest,
  FactScope,
} from "../../Facts/index.js";

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

export type FactsBackendCapabilities = {
  scopes: readonly FactScope[];
  sections: readonly FactsBackendSection[];
};

export type FactsBackend = {
  id: string;
  displayName?: string;
  capabilities: FactsBackendCapabilities;
  collect(request: FactCollectionRequest): FactCollection | Promise<FactCollection>;
};
