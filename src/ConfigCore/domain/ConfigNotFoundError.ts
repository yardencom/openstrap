export class ConfigNotFoundError extends Error {
  constructor(message = "Config file was not found") {
    super(message);
    this.name = "ConfigNotFoundError";
  }
}
