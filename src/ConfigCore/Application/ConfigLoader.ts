import { LilconfigConfigLoader } from "../Adapters/LilconfigConfigLoader.js";
import type { ConfigLoaderBackend, ConfigLoaderBackendRequest, LoadedConfig } from "../Ports/ConfigLoaderBackend.js";

export class ConfigLoader {
  private readonly backend: ConfigLoaderBackend;

  constructor() {
    this.backend = new LilconfigConfigLoader();
  }

  load(request: ConfigLoaderBackendRequest): LoadedConfig | undefined {
    return this.backend.load(request);
  }
}
