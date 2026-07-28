import {
  createOpenStrapRuntime,
  loadOpenStrapPlugin,
  loadOpenStrapPluginConfig,
  type OpenStrapRuntime,
} from "../Plugin/index.js";
import type { RuntimeArgs } from "./Arguments/index.js";

/**
 * What a command can reach: the plugins this invocation asked for.
 *
 * Built per command rather than once, because only the commands that create or reach
 * a machine need a provider or a transport. `run` and `facts collect` read the machine
 * openstrap is on, and nothing about that is pluggable.
 */
export async function createCliRuntime(args: RuntimeArgs, cwd: string): Promise<OpenStrapRuntime> {
  const config = await loadOpenStrapPluginConfig({
    cwd,
    configPath: args.runtimeConfigPath,
  });
  const plugins = await Promise.all(args.pluginSpecifiers.map((specifier) => loadOpenStrapPlugin({
    cwd,
    specifier,
  })));

  return createOpenStrapRuntime({
    config,
    plugins,
  });
}
