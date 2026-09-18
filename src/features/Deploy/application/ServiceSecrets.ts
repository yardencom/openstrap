import type { SecretStore } from "../../../Plugin/index.js";
import type { BlueprintTarget } from "../../../Modules/Blueprint/index.js";
import { MissingSecretsError } from "../errors/MissingSecretsError.js";
import { NoSecretStoreError } from "../errors/NoSecretStoreError.js";

/** The values behind the names a target's services and registries use, fetched where the store is. */
export class ServiceSecrets {
  constructor(private readonly store?: SecretStore) {}

  async valuesFor(target: BlueprintTarget): Promise<Record<string, string>> {
    const values: Record<string, string> = {};
    const missing: string[] = [];

    for (const name of ServiceSecrets.named(target)) {
      const value = (process.env[ServiceSecrets.variable(name)] ?? await this.read(name))?.trim() ?? null;

      if (value === null) {
        missing.push(name);
      } else {
        values[name] = value;
      }
    }

    if (missing.length > 0) {
      throw this.store === undefined ? new NoSecretStoreError(missing) : new MissingSecretsError(missing);
    }

    return values;
  }

  static named(target: BlueprintTarget): readonly string[] {
    const names = new Set<string>();

    for (const service of Object.values(target.services ?? {})) {
      for (const name of Object.values(service.secrets ?? {})) {
        names.add(name);
      }
    }

    for (const registry of Object.values(target.registries ?? {})) {
      names.add(registry.password);
    }

    return [...names];
  }

  private read(name: string): Promise<string | null> {
    return this.store === undefined ? Promise.resolve(null) : this.store.read({ store: this.store.id, name });
  }

  private static variable(name: string): string {
    return `OPENSTRAP_SECRET_${name.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
  }
}
