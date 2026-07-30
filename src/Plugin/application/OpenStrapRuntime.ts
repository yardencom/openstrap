import { OpenStrapConfig } from "./OpenStrapConfig.js";
import { OpenStrapPluginContainer } from "./OpenStrapPluginContainer.js";
import { PluginModule } from "./PluginModule.js";
import type { ProviderRegistry } from "./ProviderRegistry.js";
import type { SecretStoreRegistry } from "./SecretStoreRegistry.js";
import type { TransportRegistry } from "./TransportRegistry.js";

export type OpenStrapRuntimeRequest = {
  cwd: string;
  /** Where the runtime config is, when it was not left to be discovered. */
  configPath?: string;
  /** Plugin modules named on the command line, applied after the ones the project always has. */
  specifiers?: readonly string[];
};

/**
 * What one run can reach.
 *
 * Only the things a plugin can genuinely provide another implementation of: providers that create
 * machines, transports that reach them, stores that hold secrets. Reading a machine is not among
 * them — there is one way to do it, and it is the facts module, which openstrap owns (ADR 0007).
 *
 * Built from the project's own configuration first and from what a command line adds second,
 * because which plugins a project has is a property of the project.
 */
export class OpenStrapRuntime {
  readonly providers: ProviderRegistry;
  readonly transports: TransportRegistry;
  readonly secretStores: SecretStoreRegistry;
  readonly pluginNames: readonly string[];

  constructor(plugins: OpenStrapPluginContainer) {
    this.providers = plugins.providers;
    this.transports = plugins.transports;
    this.secretStores = plugins.secretStores;
    this.pluginNames = plugins.listPluginNames();
  }

  /**
   * The runtime a command line asks for: a directory, a path and some module specifiers.
   *
   * The order is the only sensible one — the config says which plugins a project always has, and
   * the specifiers add to it — so it is settled here rather than left for every caller to get right.
   */
  static async load(request: OpenStrapRuntimeRequest): Promise<OpenStrapRuntime> {
    const config = await new OpenStrapConfig(request.cwd, request.configPath).read();
    const named = await Promise.all(
      (request.specifiers ?? []).map((specifier) => new PluginModule(request.cwd, specifier).plugin()),
    );

    return new OpenStrapRuntime(await OpenStrapPluginContainer.create({
      plugins: [...(config.plugins ?? []), ...named],
    }));
  }
}
