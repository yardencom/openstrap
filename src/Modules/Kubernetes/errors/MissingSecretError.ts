export class MissingSecretError extends Error {
  constructor(name: string) {
    super(`no value was given for the secret "${name}"`);
    this.name = "MissingSecretError";
  }
}
