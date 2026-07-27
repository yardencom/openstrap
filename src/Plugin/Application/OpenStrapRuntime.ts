import type { FactsBackend } from "../Domain/FactsBackend.js";
import type { OpenStrapPluginConfig, OpenStrapPluginOption } from "../Domain/OpenStrapPlugin.js";
import { coreFactsBackendId, openstrapCorePlugin } from "../Core/OpenStrapCorePlugin.js";
import { OpenStrapPluginContainer } from "./OpenStrapPluginContainer.js";
import type { FactsBackendRegistry } from "./FactsBackendRegistry.js";
import type { ProviderRegistry } from "./ProviderRegistry.js";
import type { SecretStoreRegistry } from "./SecretStoreRegistry.js";
import type { TransportRegistry } from "./TransportRegistry.js";

export type OpenStrapRuntimeCreateRequest = {
  config?: OpenStrapPluginConfig;
  factsBackendId?: string;
  plugins?: readonly OpenStrapPluginOption[];
};

export type OpenStrapRuntime = {
  factsBackends: FactsBackendRegistry;
  factsBackend: FactsBackend;
  factsBackendId: string;
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
      openstrapCorePlugin(),
      ...(config.plugins ?? []),
      ...(request.plugins ?? []),
    ],
  });
  const factsBackendId = request.factsBackendId ?? config.facts?.backend ?? coreFactsBackendId;

  return {
    factsBackends: container.factsBackends,
    factsBackend: container.factsBackends.require(factsBackendId),
    factsBackendId,
    providers: container.providers,
    transports: container.transports,
    secretStores: container.secretStores,
    pluginNames: container.listPluginNames(),
  };
}
