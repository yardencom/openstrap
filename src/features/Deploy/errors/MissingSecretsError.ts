export class MissingSecretsError extends Error {
  constructor(readonly names: readonly string[]) {
    super(`no value was found for ${names.length === 1 ? "the secret" : "the secrets"} ${names.map((name) => `"${name}"`).join(", ")}`);
    this.name = "MissingSecretsError";
  }
}
