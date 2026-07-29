import type { Provider } from "@openstrap/plugin-contract";
import { OpenStrapPluginError } from "../errors/OpenStrapPluginError.js";

export type RegisteredProvider = {
  provider: Provider;
  pluginName: string;
};

const requiredOperations = [
  "detect",
  "resolveImage",
  "create",
  "start",
  "stop",
  "restart",
  "delete",
  "inspect",
  "access",
  "find",
] as const;

export class ProviderRegistry {
  private readonly providers = new Map<string, RegisteredProvider>();

  register(provider: Provider, pluginName: string): void {
    validateProvider(provider, pluginName);

    const existing = this.providers.get(provider.id);
    if (existing) {
      throw new OpenStrapPluginError(
        `Provider "${provider.id}" is already registered by plugin "${existing.pluginName}"`,
      );
    }

    this.providers.set(provider.id, {
      provider,
      pluginName,
    });
  }

  get(id: string): Provider | undefined {
    return this.providers.get(id)?.provider;
  }

  require(id: string): Provider {
    const provider = this.get(id);

    if (!provider) {
      throw new OpenStrapPluginError(
        `Provider "${id}" is not registered. Available providers: ${this.list().map((item) => item.provider.id).join(", ")}`,
      );
    }

    return provider;
  }

  list(): readonly RegisteredProvider[] {
    return [...this.providers.values()];
  }
}

function validateProvider(provider: Provider, pluginName: string): void {
  if (!provider.id || typeof provider.id !== "string") {
    throw new OpenStrapPluginError(`Plugin "${pluginName}" registered a provider without string id`);
  }

  if (!provider.capabilities || provider.capabilities.scopes.length === 0) {
    throw new OpenStrapPluginError(`Provider "${provider.id}" must declare at least one scope capability`);
  }

  if (provider.capabilities.types.length === 0) {
    throw new OpenStrapPluginError(`Provider "${provider.id}" must declare at least one target type capability`);
  }

  for (const operation of requiredOperations) {
    if (typeof provider[operation] !== "function") {
      throw new OpenStrapPluginError(`Provider "${provider.id}" must expose ${operation}()`);
    }
  }
}
