import type { Provider } from "./Provider.js";
import type { SecretStore } from "./Secret.js";
import type { TransportConnector } from "./Transport.js";

export type OpenStrapPluginOrder = "pre" | "post";

/**
 * What a plugin may contribute to a run.
 *
 * A plugin is named after the tool it integrates, not after the slot it fills,
 * because one tool can fill several: Docker will register a provider and a
 * transport at once.
 */
export type OpenStrapPluginApi = {
  registerProvider(provider: Provider): void;
  registerTransport(connector: TransportConnector): void;
  registerSecretStore(store: SecretStore): void;
};

export type OpenStrapPlugin = {
  name: string;
  enforce?: OpenStrapPluginOrder;
  setup?(api: OpenStrapPluginApi): void | Promise<void>;
};

export type OpenStrapPluginOption =
  | OpenStrapPlugin
  | false
  | null
  | undefined
  | readonly OpenStrapPluginOption[];

export type OpenStrapPluginConfig = {
  plugins?: readonly OpenStrapPluginOption[];
};

export function defineOpenStrapPlugin(plugin: OpenStrapPlugin): OpenStrapPlugin {
  return plugin;
}

export function defineOpenStrapConfig(config: OpenStrapPluginConfig): OpenStrapPluginConfig {
  return config;
}
