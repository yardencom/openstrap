import { KeychainSecretStore, keychainStoreId } from "../../../Secrets/index.js";
import type { Reveal } from "../../../Modules/Steps/index.js";
import type { SecretStore } from "../../../Plugin/index.js";
import type { Step } from "#types/Step.js";

/**
 * Where a step's secret comes from, wherever the step is running.
 *
 * Two sources, tried in that order, and one implementation for both places openstrap converges from.
 * There is no branch on "am I on the machine or on the host", because that branch is how two ways of
 * doing one thing start.
 *
 * - The process environment, under `OPENSTRAP_SECRET_<name>`. This is how a secret reaches a machine
 *   openstrap is not on: the store lives where openstrap was installed, so the value is fetched there
 *   and handed to the openstrap that was delivered, as an environment variable of that process. The
 *   blueprint that travels carries the name and not the value.
 * - The store itself. On the machine openstrap runs on there is one, and on a delivered openstrap
 *   there is not — asking a keychain that is not there answers nothing, which is the right answer.
 *
 * What this deliberately does not do is put the value anywhere that outlives the process: not in the
 * blueprint written next to the delivered binary, not in the plan, not on disk at all.
 */
export class StepSecrets {
  constructor(private readonly store: SecretStore = new KeychainSecretStore()) {}

  /** What `Steps` is handed to answer a name a step wrote instead of a value. */
  reveal(): Reveal {
    return async (name: string) => process.env[variable(name)] ?? await this.read(name);
  }

  /**
   * Every secret these steps name, fetched, ready to be handed to an openstrap somewhere else.
   *
   * Named after the variables they will arrive in rather than after the secrets, because the far side
   * looks them up that way and nothing there knows what a store is.
   *
   * A name nothing can answer is left out. The step that wanted it fails over there, where it would
   * have failed anyway, and says which name — rather than failing here before anything has been read.
   */
  async forDelivery(steps: readonly Step[]): Promise<Record<string, string>> {
    const carried: Record<string, string> = {};

    for (const name of named(steps)) {
      const value = await this.read(name);

      if (value !== null) {
        carried[variable(name)] = value;
      }
    }

    return carried;
  }

  private read(name: string): Promise<string | null> {
    return this.store.read({ store: this.store.id ?? keychainStoreId, name });
  }
}

/** Every secret named by any of these steps, each once. */
function named(steps: readonly Step[]): readonly string[] {
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

/**
 * The variable one secret travels in.
 *
 * A name a person writes — `openstrap-server.master-key` — is not a variable name, so it is spelled
 * as one. Both sides derive it from the same name by the same rule, so neither has to be told.
 */
function variable(name: string): string {
  return `OPENSTRAP_SECRET_${name.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
}
