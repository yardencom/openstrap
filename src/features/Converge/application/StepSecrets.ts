import { KeychainSecretStore, keychainStoreId } from "../../../Secrets/index.js";
import type { Reveal } from "../../../Modules/Steps/index.js";
import type { SecretStore } from "../../../Plugin/index.js";
import type { Step } from "#types/Step.js";

/** Where a step's secret comes from, wherever the step is running. */
export class StepSecrets {
  constructor(private readonly store: SecretStore = new KeychainSecretStore()) {}

  /** What `Steps` is handed to answer a name a step wrote instead of a value. */
  reveal(): Reveal {
    return async (name: string) => process.env[StepSecrets.variable(name)] ?? await this.read(name);
  }

  /** Every secret these steps name, fetched, ready to be handed to an openstrap somewhere else. */
  async forDelivery(steps: readonly Step[]): Promise<Record<string, string>> {
    const carried: Record<string, string> = {};

    for (const name of StepSecrets.named(steps)) {
      const value = await this.read(name);

      if (value !== null) {
        carried[StepSecrets.variable(name)] = value;
      }
    }

    return carried;
  }

  private read(name: string): Promise<string | null> {
    return this.store.read({ store: this.store.id ?? keychainStoreId, name });
  }

  private static named(steps: readonly Step[]): readonly string[] {
    const names = new Set<string>();

    for (const step of steps) {
      const environment = step.action.kind === "run" ? step.action.environment : undefined;

      for (const value of Object.values(environment ?? {})) {
        if (typeof value !== "string") {
          names.add(value.secret);
        }
      }
    }

    return [...names];
  }

  /** The variable one secret travels in. */
  private static variable(name: string): string {
    return `OPENSTRAP_SECRET_${name.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
  }
}

/** Every secret named by any of these steps, each once. */
