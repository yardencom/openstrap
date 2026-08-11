import type { SecretStore } from "@openstrap/plugin-contract";
import { OpenStrapPluginError } from "../errors/OpenStrapPluginError.js";

export type RegisteredSecretStore = {
  store: SecretStore;
  pluginName: string;
};

export class SecretStoreRegistry {
  private readonly stores = new Map<string, RegisteredSecretStore>();

  register(store: SecretStore, pluginName: string): void {
    SecretStoreRegistry.validateSecretStore(store, pluginName);

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

  /** The store to use when nothing names one, which is what a blueprint's `{ secret: … }` does. */
  sole(): SecretStore {
    const store = this.soleIfAny();

    if (!store) {
      throw new OpenStrapPluginError(
        "No secret store is registered. openstrap keeps none of its own: a plugin has to provide one.",
      );
    }

    return store;
  }

  /** The same, where having none is an answer: a run that names no secret needs no store. */
  soleIfAny(): SecretStore | undefined {
    const [only, ...rest] = this.list();

    if (rest.length > 0) {
      throw new OpenStrapPluginError(
        `Several secret stores are registered (${this.list().map((item) => item.store.id).join(", ")}), `
        + "so which one holds a secret has to be said rather than guessed.",
      );
    }

    return only?.store;
  }

  private static validateSecretStore(store: SecretStore, pluginName: string): void {
    if (!store.id || typeof store.id !== "string") {
      throw new OpenStrapPluginError(`Plugin "${pluginName}" registered a secret store without string id`);
    }

    for (const operation of ["read", "write", "remove"] as const) {
      if (typeof store[operation] !== "function") {
        throw new OpenStrapPluginError(`Secret store "${store.id}" must expose ${operation}()`);
      }
    }
  }
}
