import type { OpenStrapPluginConfig, OpenStrapPluginOption } from "../Domain/OpenStrapPlugin.js";
import { OpenStrapPluginContainer } from "./OpenStrapPluginContainer.js";
import type { ProviderRegistry } from "./ProviderRegistry.js";
import type { SecretStoreRegistry } from "./SecretStoreRegistry.js";
import type { TransportRegistry } from "./TransportRegistry.js";

export type OpenStrapRuntimeCreateRequest = {
  config?: OpenStrapPluginConfig;
  plugins?: readonly OpenStrapPluginOption[];
};

/**
 * What a run can reach.
 *
 * Only the things a plugin can genuinely provide another implementation of:
 * providers that create machines, transports that reach them, stores that hold
 * secrets. Facts are not among them — there is one way to read a machine, and it
 * is the facts module, which openstrap owns.
 */
export type OpenStrapRuntime = {
  providers: ProviderRegistry;
  transports: TransportRegistry;
  secretStores: SecretStoreRegistry;
  pluginNames: readonly string[];
};

export async function createOpenStrapRuntime(
  request: OpenStrapRuntimeCreateRequest = {},
): Promise<OpenStrapRuntime> {
  const config = request.config ?? {};
  const container = await OpenStrapPluginContainer.create({
    plugins: [
      ...(config.plugins ?? []),
      ...(request.plugins ?? []),
    ],
  });

  return {
    providers: container.providers,
    transports: container.transports,
    secretStores: container.secretStores,
    pluginNames: container.listPluginNames(),
  };
}
