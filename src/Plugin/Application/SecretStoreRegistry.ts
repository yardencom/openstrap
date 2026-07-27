import type { SecretStore } from "../Domain/Secret.js";
import { OpenStrapPluginError } from "../Domain/OpenStrapPluginError.js";

export type RegisteredSecretStore = {
  store: SecretStore;
  pluginName: string;
};

export class SecretStoreRegistry {
  private readonly stores = new Map<string, RegisteredSecretStore>();

  register(store: SecretStore, pluginName: string): void {
    validateSecretStore(store, pluginName);

    const existing = this.stores.get(store.id);
    if (existing) {
      throw new OpenStrapPluginError(
        `Secret store "${store.id}" is already registered by plugin "${existing.pluginName}"`,
      );
    }

    this.stores.set(store.id, {
      store,
      pluginName,
    });
  }

  get(id: string): SecretStore | undefined {
    return this.stores.get(id)?.store;
  }

  require(id: string): SecretStore {
    const store = this.get(id);

    if (!store) {
      throw new OpenStrapPluginError(
        `Secret store "${id}" is not registered. Available secret stores: ${this.list().map((item) => item.store.id).join(", ")}`,
      );
    }

    return store;
  }

  list(): readonly RegisteredSecretStore[] {
    return [...this.stores.values()];
  }
}

function validateSecretStore(store: SecretStore, pluginName: string): void {
  if (!store.id || typeof store.id !== "string") {
    throw new OpenStrapPluginError(`Plugin "${pluginName}" registered a secret store without string id`);
  }

  for (const operation of ["read", "write", "remove"] as const) {
    if (typeof store[operation] !== "function") {
      throw new OpenStrapPluginError(`Secret store "${store.id}" must expose ${operation}()`);
    }
  }
}
