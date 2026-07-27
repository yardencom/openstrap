import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { SecretReference, SecretStore } from "../Plugin/index.js";

const run = promisify(execFile);

export const keychainStoreId = "keychain";

/**
 * Keeps secrets in the macOS login keychain.
 *
 * Values are passed to `security` as arguments of a spawned process rather
 * than through a shell, so nothing is interpolated into a command line that a
 * shell would parse.
 */
export class KeychainSecretStore implements SecretStore {
  readonly id = keychainStoreId;
  readonly displayName = "macOS keychain";

  constructor(private readonly service = "openstrap") {}

  async read(reference: SecretReference): Promise<string | null> {
    try {
      const { stdout } = await run("security", [
        "find-generic-password",
        "-s", this.service,
        "-a", reference.name,
        "-w",
      ]);

      return Buffer.from(stdout.trim(), "base64").toString("utf8");
    } catch {
      return null;
    }
  }

  /** Writing an existing secret replaces it rather than adding a second entry. */
  async write(reference: SecretReference, value: string): Promise<void> {
    await run("security", [
      "add-generic-password",
      "-s", this.service,
      "-a", reference.name,
      "-w", Buffer.from(value, "utf8").toString("base64"),
      "-U",
    ]);
  }

  async remove(reference: SecretReference): Promise<void> {
    try {
      await run("security", [
        "delete-generic-password",
        "-s", this.service,
        "-a", reference.name,
      ]);
    } catch {
      // Removing a secret that is not there is not a failure.
    }
  }

  reference(name: string): SecretReference {
    return { store: this.id, name };
  }
}
