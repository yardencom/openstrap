import type { FactsBackend } from "./FactsBackend.js";

export type OpenStrapPluginOrder = "pre" | "post";

export type OpenStrapPluginApi = {
  registerFactsBackend(backend: FactsBackend): void;
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
  facts?: {
    backend?: string;
  };
};

export function defineOpenStrapPlugin(plugin: OpenStrapPlugin): OpenStrapPlugin {
  return plugin;
}

export function defineOpenStrapConfig(config: OpenStrapPluginConfig): OpenStrapPluginConfig {
  return config;
}
