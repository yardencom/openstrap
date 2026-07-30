import type { ProviderAvailability } from "../../../Plugin/index.js";

export class ProviderUnavailableError extends Error {
  constructor(providerId: string, availability: ProviderAvailability) {
    const install = availability.install ? `\n\n${availability.install.description}\n  ${availability.install.command}` : "";

    super(`Provider "${providerId}" is not available: ${availability.reason ?? "unknown reason"}${install}`);
    this.name = "ProviderUnavailableError";
  }
}
