import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { OpenStrapPluginError } from "../Domain/OpenStrapPluginError.js";
import type {
  OpenStrapPlugin,
  OpenStrapPluginConfig,
} from "../Domain/OpenStrapPlugin.js";

const defaultConfigFiles = [
  "openstrap.config.mjs",
  "openstrap.config.js",
];

export type LoadOpenStrapPluginConfigRequest = {
  cwd: string;
  configPath?: string;
};

export type LoadOpenStrapPluginRequest = {
  cwd: string;
  specifier: string;
};

export async function loadOpenStrapPluginConfig(
  request: LoadOpenStrapPluginConfigRequest,
): Promise<OpenStrapPluginConfig> {
  const configPath = request.configPath
    ? resolve(request.cwd, request.configPath)
    : findDefaultConfigPath(request.cwd);

  if (!configPath) {
    return {};
  }

  const module = await import(pathToFileURL(configPath).href);
  const config = readConfigExport(module, configPath);

  return validateConfig(config, configPath);
}

export async function loadOpenStrapPlugin(
  request: LoadOpenStrapPluginRequest,
): Promise<OpenStrapPlugin> {
  const moduleUrl = resolvePluginModuleUrl(request.specifier, request.cwd);
  const module = await import(moduleUrl);
  const plugin = await readPluginExport(module, request.specifier);

  return validatePlugin(plugin, request.specifier);
}

function findDefaultConfigPath(cwd: string): string | undefined {
  return defaultConfigFiles
    .map((fileName) => join(cwd, fileName))
    .find((candidate) => existsSync(candidate));
}

function resolvePluginModuleUrl(specifier: string, cwd: string): string {
  if (specifier.startsWith("file:")) {
    return specifier;
  }

  if (isPathSpecifier(specifier)) {
    return pathToFileURL(resolve(cwd, specifier)).href;
  }

  const require = createRequire(pathToFileURL(join(cwd, "openstrap.config.mjs")).href);
  return pathToFileURL(require.resolve(specifier)).href;
}

function isPathSpecifier(specifier: string): boolean {
  return specifier.startsWith(".") || isAbsolute(specifier);
}

function readConfigExport(module: Record<string, unknown>, configPath: string): unknown {
  if ("default" in module) {
    return module.default;
  }

  if ("openstrapConfig" in module) {
    return module.openstrapConfig;
  }

  throw new OpenStrapPluginError(`OpenStrap plugin config "${configPath}" must export default config`);
}

async function readPluginExport(module: Record<string, unknown>, specifier: string): Promise<unknown> {
  const candidate = module.default ?? module.openstrapPlugin ?? module.plugin;

  if (candidate) {
    return typeof candidate === "function" ? candidate() : candidate;
  }

  if (typeof module.createOpenStrapPlugin === "function") {
    return module.createOpenStrapPlugin();
  }

  throw new OpenStrapPluginError(
    `OpenStrap plugin "${specifier}" must export default plugin or createOpenStrapPlugin()`,
  );
}

function validateConfig(value: unknown, configPath: string): OpenStrapPluginConfig {
  if (!isRecord(value)) {
    throw new OpenStrapPluginError(`OpenStrap plugin config "${configPath}" must export an object`);
  }

  if (value.plugins !== undefined && !Array.isArray(value.plugins)) {
    throw new OpenStrapPluginError(`OpenStrap plugin config "${configPath}" field plugins must be an array`);
  }

  if (value.facts !== undefined && !isRecord(value.facts)) {
    throw new OpenStrapPluginError(`OpenStrap plugin config "${configPath}" field facts must be an object`);
  }

  if (isRecord(value.facts) && value.facts.backend !== undefined && typeof value.facts.backend !== "string") {
    throw new OpenStrapPluginError(`OpenStrap plugin config "${configPath}" field facts.backend must be a string`);
  }

  return value as OpenStrapPluginConfig;
}

function validatePlugin(value: unknown, source: string): OpenStrapPlugin {
  if (!isRecord(value)) {
    throw new OpenStrapPluginError(`OpenStrap plugin "${source}" must export an object`);
  }

  if (typeof value.name !== "string" || value.name.length === 0) {
    throw new OpenStrapPluginError(`OpenStrap plugin "${source}" must declare a string name`);
  }

  if (value.enforce !== undefined && value.enforce !== "pre" && value.enforce !== "post") {
    throw new OpenStrapPluginError(`OpenStrap plugin "${source}" field enforce must be "pre" or "post"`);
  }

  if (value.setup !== undefined && typeof value.setup !== "function") {
    throw new OpenStrapPluginError(`OpenStrap plugin "${source}" field setup must be a function`);
  }

  return value as OpenStrapPlugin;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
