import { createRequire } from "node:module";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { OpenStrapPlugin } from "@openstrap/plugin-contract";
import { OpenStrapPluginError } from "../errors/OpenStrapPluginError.js";

/** A plugin as a module on disk, before it is anything else. */
export class PluginModule {
  constructor(
    private readonly cwd: string,
    readonly specifier: string,
  ) {}

  async plugin(): Promise<OpenStrapPlugin> {
    const module = await import(this.url()) as Record<string, unknown>;

    return PluginModule.validate(await PluginModule.exported(module, this.specifier), this.specifier);
  }

  private url(): string {
    if (this.specifier.startsWith("file:")) {
      return this.specifier;
    }

    if (this.specifier.startsWith(".") || isAbsolute(this.specifier)) {
      return pathToFileURL(resolve(this.cwd, this.specifier)).href;
    }

    // Resolved as the project resolves it, not as openstrap would: the plugin is installed beside
    // the project, and openstrap may be running from anywhere at all, including a single binary.
    const require = createRequire(pathToFileURL(join(this.cwd, "openstrap.config.mjs")).href);

    return pathToFileURL(require.resolve(this.specifier)).href;
  }

  private static async exported(module: Record<string, unknown>, specifier: string): Promise<unknown> {
    const candidate = module.default ?? module.openstrapPlugin ?? module.plugin;

    if (candidate) {
      return typeof candidate === "function" ? (candidate as () => unknown)() : candidate;
    }

    if (typeof module.createOpenStrapPlugin === "function") {
      return (module.createOpenStrapPlugin as () => unknown)();
    }

    throw new OpenStrapPluginError(
      `OpenStrap plugin "${specifier}" must export default plugin or createOpenStrapPlugin()`,
    );
  }

  private static validate(value: unknown, specifier: string): OpenStrapPlugin {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new OpenStrapPluginError(`OpenStrap plugin "${specifier}" must export an object`);
    }

    const plugin = value as Record<string, unknown>;

    if (typeof plugin.name !== "string" || plugin.name.length === 0) {
      throw new OpenStrapPluginError(`OpenStrap plugin "${specifier}" must declare a string name`);
    }

    if (plugin.enforce !== undefined && plugin.enforce !== "pre" && plugin.enforce !== "post") {
      throw new OpenStrapPluginError(`OpenStrap plugin "${specifier}" field enforce must be "pre" or "post"`);
    }

    if (plugin.setup !== undefined && typeof plugin.setup !== "function") {
      throw new OpenStrapPluginError(`OpenStrap plugin "${specifier}" field setup must be a function`);
    }

    return value as OpenStrapPlugin;
  }
}

/** A plugin may be the export itself or a function that makes one, which is how it takes options. */
