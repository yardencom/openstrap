import type { OpenStrapPluginOption } from "@openstrap/plugin-contract";
import { Images } from "../../Modules/Images/index.js";
import type { CommandRegistry } from "./CommandRegistry.js";
import { OpenStrapConfig } from "./OpenStrapConfig.js";
import { OpenStrapPluginContainer } from "./OpenStrapPluginContainer.js";
import { PluginModule } from "./PluginModule.js";
import type { ProviderRegistry } from "./ProviderRegistry.js";
import type { SecretStoreRegistry } from "./SecretStoreRegistry.js";
import type { TransportRegistry } from "./TransportRegistry.js";

export type OpenStrapRuntimeRequest = {
  cwd: string;
  /** Plugins openstrap always has, applied before the project's own. Its own commands are one. */
  plugins?: readonly OpenStrapPluginOption[];
  /** Where the runtime config is, when it was not left to be discovered. */
  configPath?: string;
  /** Plugin modules named on the command line, applied after the ones the project always has. */
  specifiers?: readonly string[];
};

/** What one run can reach. */
export class OpenStrapRuntime {
  /** Where each `image:` name is published, asked of the publisher rather than kept as a list. */
  readonly images = new Images();
  readonly commands: CommandRegistry;
  readonly providers: ProviderRegistry;
  readonly transports: TransportRegistry;
  readonly secretStores: SecretStoreRegistry;
  readonly pluginNames: readonly string[];

  constructor(plugins: OpenStrapPluginContainer) {
    this.commands = plugins.commands;
    this.providers = plugins.providers;
    this.transports = plugins.transports;
    this.secretStores = plugins.secretStores;
    this.pluginNames = plugins.listPluginNames();
  }

  /** The runtime a command line asks for: a directory, a path and some module specifiers. */
  static async load(request: OpenStrapRuntimeRequest): Promise<OpenStrapRuntime> {
    const config = await new OpenStrapConfig(request.cwd, request.configPath).read();
    const named = await Promise.all(
      (request.specifiers ?? []).map((specifier) => new PluginModule(request.cwd, specifier).plugin()),
    );

    return new OpenStrapRuntime(await OpenStrapPluginContainer.create({
      plugins: [...(request.plugins ?? []), ...(config.plugins ?? []), ...named],
    }));
  }
}
