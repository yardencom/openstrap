import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { OpenStrapPluginConfig } from "@openstrap/plugin-contract";
import { OpenStrapPluginError } from "../errors/OpenStrapPluginError.js";

const fileNames = ["openstrap.config.mjs", "openstrap.config.js"];

/**
 * The runtime configuration of a project: which plugins it has.
 *
 * Found on disk rather than named on the command line, because what a project is built with is a
 * property of the project. A run may add to it — `--plugin` — but the list a project always has is
 * written down in it, and openstrap has to be able to read that list before it knows what any word
 * on the command line means.
 *
 * A project without the file is not an error: openstrap with no plugins can still read the machine
 * it runs on. It is the commands that plugins bring which then do not exist.
 */
export class OpenStrapConfig {
  constructor(
    private readonly cwd: string,
    private readonly explicitPath?: string,
  ) {}

  /** Where the file is, or nothing when the project has none. */
  path(): string | undefined {
    return this.explicitPath
      ? resolve(this.cwd, this.explicitPath)
      : fileNames.map((fileName) => join(this.cwd, fileName)).find((candidate) => existsSync(candidate));
  }

  async read(): Promise<OpenStrapPluginConfig> {
    const path = this.path();

    if (!path) {
      return {};
    }

    const module = await import(pathToFileURL(path).href) as Record<string, unknown>;

    return validate(exported(module, path), path);
  }
}

function exported(module: Record<string, unknown>, path: string): unknown {
  if ("default" in module) {
    return module.default;
  }

  if ("openstrapConfig" in module) {
    return module.openstrapConfig;
  }

  throw new OpenStrapPluginError(`OpenStrap plugin config "${path}" must export default config`);
}

function validate(value: unknown, path: string): OpenStrapPluginConfig {
  if (!isRecord(value)) {
    throw new OpenStrapPluginError(`OpenStrap plugin config "${path}" must export an object`);
  }

  if (value.plugins !== undefined && !Array.isArray(value.plugins)) {
    throw new OpenStrapPluginError(`OpenStrap plugin config "${path}" field plugins must be an array`);
  }

  return value as OpenStrapPluginConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
