import { CommandRegistry } from "./CommandRegistry.js";
import { ProviderRegistry } from "./ProviderRegistry.js";
import { SecretStoreRegistry } from "./SecretStoreRegistry.js";
import { TransportRegistry } from "./TransportRegistry.js";
import { OpenStrapPluginError } from "../errors/OpenStrapPluginError.js";
import type {
  OpenStrapPlugin,
  OpenStrapPluginApi,
  OpenStrapPluginOption,
} from "@openstrap/plugin-contract";

export type OpenStrapPluginContainerCreateRequest = {
  plugins?: readonly OpenStrapPluginOption[];
};

export class OpenStrapPluginContainer {
  readonly commands = new CommandRegistry();
  readonly providers = new ProviderRegistry();
  readonly transports = new TransportRegistry();
  readonly secretStores = new SecretStoreRegistry();
  private readonly pluginNames: string[] = [];

  static async create(request: OpenStrapPluginContainerCreateRequest = {}): Promise<OpenStrapPluginContainer> {
    const container = new OpenStrapPluginContainer();
    const plugins = orderPlugins(flattenPluginOptions(request.plugins ?? []));

    for (const plugin of plugins) {
      await container.apply(plugin);
    }

    return container;
  }

  listPluginNames(): readonly string[] {
    return [...this.pluginNames];
  }

  private async apply(plugin: OpenStrapPlugin): Promise<void> {
    if (!plugin.name || typeof plugin.name !== "string") {
      throw new OpenStrapPluginError("OpenStrap plugin must declare a string name");
    }

    if (this.pluginNames.includes(plugin.name)) {
      throw new OpenStrapPluginError(`OpenStrap plugin "${plugin.name}" is already applied`);
    }

    this.pluginNames.push(plugin.name);

    if (plugin.setup) {
      await plugin.setup(this.createApi(plugin.name));
    }
  }

  private createApi(pluginName: string): OpenStrapPluginApi {
    return {
      registerCommand: (command) => {
        this.commands.register(command, pluginName);
      },
      registerProvider: (provider) => {
        this.providers.register(provider, pluginName);
      },
      registerTransport: (connector) => {
        this.transports.register(connector, pluginName);
      },
      registerSecretStore: (store) => {
        this.secretStores.register(store, pluginName);
      },
    };
  }
}

function flattenPluginOptions(options: readonly OpenStrapPluginOption[]): OpenStrapPlugin[] {
  return options.flatMap((option): OpenStrapPlugin[] => {
    if (!option) {
      return [];
    }

    if (isPluginOptionArray(option)) {
      return flattenPluginOptions(option);
    }

    return [option];
  });
}

function isPluginOptionArray(option: OpenStrapPluginOption): option is readonly OpenStrapPluginOption[] {
  return Array.isArray(option);
}

function orderPlugins(plugins: readonly OpenStrapPlugin[]): OpenStrapPlugin[] {
  const pre = plugins.filter((plugin) => plugin.enforce === "pre");
  const normal = plugins.filter((plugin) => !plugin.enforce);
  const post = plugins.filter((plugin) => plugin.enforce === "post");

  return [...pre, ...normal, ...post];
}
