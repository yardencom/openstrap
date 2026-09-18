export class NoSecretStoreError extends Error {
  constructor(readonly names: readonly string[]) {
    super(
      `no secret store is loaded, so ${names.map((name) => `"${name}"`).join(", ")} cannot be read; ` +
      "add a secret-store plugin, such as the keychain, to openstrap.config.mjs",
    );
    this.name = "NoSecretStoreError";
  }
}
