import type { OpenStrapPluginConfig, OpenStrapPluginOption } from "../Domain/OpenStrapPlugin.js";
import { loadOpenStrapPlugin, loadOpenStrapPluginConfig } from "./OpenStrapPluginLoader.js";
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

export type LoadOpenStrapRuntimeRequest = {
  cwd: string;
  /** Where the runtime config is, when it was not left to be discovered. */
  configPath?: string;
  /** Plugin modules named on the command line, applied after the config's own. */
  specifiers?: readonly string[];
};

/**
 * A runtime built from what a command line can give: a directory, a path and some
 * module specifiers.
 *
 * The order is the only sensible one — the config decides which plugins a project
 * always has, and the specifiers add to it — so it is settled here rather than left
 * for every caller to get right. `createOpenStrapRuntime` still takes already-loaded
 * objects, because a test that had to write plugin modules to disk to check the
 * registry would be testing the loader instead.
 */
export async function loadOpenStrapRuntime(request: LoadOpenStrapRuntimeRequest): Promise<OpenStrapRuntime> {
  const config = await loadOpenStrapPluginConfig({
    cwd: request.cwd,
    configPath: request.configPath,
  });
  const plugins = await Promise.all((request.specifiers ?? []).map((specifier) => loadOpenStrapPlugin({
    cwd: request.cwd,
    specifier,
  })));

  return createOpenStrapRuntime({ config, plugins });
}
