import type { FactsBackend } from "../Domain/FactsBackend.js";
import { OpenStrapPluginError } from "../Domain/OpenStrapPluginError.js";

export type RegisteredFactsBackend = {
  backend: FactsBackend;
  pluginName: string;
};

export class FactsBackendRegistry {
  private readonly backends = new Map<string, RegisteredFactsBackend>();

  register(backend: FactsBackend, pluginName: string): void {
    validateFactsBackend(backend, pluginName);

    const existing = this.backends.get(backend.id);
    if (existing) {
      throw new OpenStrapPluginError(
        `Facts backend "${backend.id}" is already registered by plugin "${existing.pluginName}"`,
      );
    }

    this.backends.set(backend.id, {
      backend,
      pluginName,
    });
  }

  get(id: string): FactsBackend | undefined {
    return this.backends.get(id)?.backend;
  }

  require(id: string): FactsBackend {
    const backend = this.get(id);

    if (!backend) {
      throw new OpenStrapPluginError(
        `Facts backend "${id}" is not registered. Available backends: ${this.list().map((item) => item.backend.id).join(", ")}`,
      );
    }

    return backend;
  }

  list(): readonly RegisteredFactsBackend[] {
    return [...this.backends.values()];
  }
}

function validateFactsBackend(backend: FactsBackend, pluginName: string): void {
  if (!backend.id || typeof backend.id !== "string") {
    throw new OpenStrapPluginError(`Plugin "${pluginName}" registered a facts backend without string id`);
  }

  if (!backend.capabilities || backend.capabilities.scopes.length === 0) {
    throw new OpenStrapPluginError(`Facts backend "${backend.id}" must declare at least one scope capability`);
  }

  if (backend.capabilities.sections.length === 0) {
    throw new OpenStrapPluginError(`Facts backend "${backend.id}" must declare at least one section capability`);
  }

  if (typeof backend.collect !== "function") {
    throw new OpenStrapPluginError(`Facts backend "${backend.id}" must expose collect(request)`);
  }
}
