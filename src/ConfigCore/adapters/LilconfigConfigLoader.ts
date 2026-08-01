import envPaths from "env-paths";
import { lilconfigSync } from "lilconfig";
import { relative, resolve } from "node:path";
import { parseDocument } from "yaml";

import { ConfigParseError } from "../errors/ConfigParseError.js";
import { ConfigReadError } from "../errors/ConfigReadError.js";
import type {
  ConfigLoadRequest,
  ConfigLoaderBackend,
  ConfigLoaderBackendRequest,
  LoadedConfig,
} from "../ports/ConfigLoaderBackend.js";

type LilconfigResult = {
  filepath: string;
  config: unknown;
} | null;

const defaultFilePatterns = ["openstrap.yaml", ".openstrap/config.yaml"];

export class LilconfigConfigLoader implements ConfigLoaderBackend {
  private readonly userConfigRoot: string;

  constructor(params: { appName?: string; userConfigRoot?: string } = {}) {
    this.userConfigRoot = params.userConfigRoot ?? envPaths(params.appName ?? "openstrap", { suffix: "" }).config;
  }

  load(request: ConfigLoaderBackendRequest): LoadedConfig | undefined {
    if ("content" in request) {
      return parseInlineYaml(request);
    }

    if ("path" in request) {
      return this.loadFile(request.path, "explicit", request.filePatterns);
    }

    if ("searchRoot" in request) {
      return this.searchDirectory(request.searchRoot, "workspace", request.filePatterns);
    }

    if ("user" in request) {
      return this.searchDirectory(this.userConfigRoot, "user", request.filePatterns);
    }

    return this.resolveConfig(request);
  }

  private resolveConfig(request: Extract<ConfigLoaderBackendRequest, { workspaceRoot: string }>): LoadedConfig | undefined {
    if (request.explicitPath) {
      return this.loadFile(request.explicitPath, "explicit", request.filePatterns);
    }

    const workspaceConfig = this.searchDirectory(request.workspaceRoot, "workspace", request.filePatterns);

    if (workspaceConfig) {
      return workspaceConfig;
    }

    return request.includeUser === false ? undefined : this.searchDirectory(this.userConfigRoot, "user", request.filePatterns);
  }

  private loadFile(
    filePath: string,
    scope: "explicit" | "workspace" | "user",
    filePatterns: readonly string[],
  ): LoadedConfig | undefined {
    return this.runLilconfig(() => this.createExplorer(filePatterns).load(resolve(filePath)), {
      scope,
      searchRoot: undefined,
      filePatterns,
    });
  }

  private searchDirectory(
    searchRoot: string,
    scope: "workspace" | "user",
    filePatterns: readonly string[],
  ): LoadedConfig | undefined {
    const resolvedSearchRoot = resolve(searchRoot);

    return this.runLilconfig(
      () => this.createExplorer(filePatterns, resolvedSearchRoot).search(resolvedSearchRoot),
      {
        scope,
        searchRoot: resolvedSearchRoot,
        filePatterns,
      },
    );
  }

  private createExplorer(filePatterns: readonly string[], stopDir?: string) {
    return lilconfigSync("openstrap", {
      searchPlaces: this.searchPlaces(filePatterns),
      stopDir,
      loaders: {
        ".yaml": loadYaml,
        ".yml": loadYaml,
        noExt: loadYaml,
      },
    });
  }

  private runLilconfig(
    load: () => LilconfigResult,
    params: {
      scope: "explicit" | "workspace" | "user";
      searchRoot: string | undefined;
      filePatterns: readonly string[];
    },
  ): LoadedConfig | undefined {
    try {
      const result = load();

      if (!result) {
        return undefined;
      }

      return {
        format: "yaml",
        value: result.config,
        source: {
          type: "file",
          scope: params.scope,
          path: result.filepath,
          format: "yaml",
          searchRoot: params.searchRoot,
          matchedPattern: findMatchedPattern(result.filepath, params.searchRoot, this.searchPlaces(params.filePatterns)),
        },
      };
    } catch (error) {
      if (error instanceof ConfigParseError) {
        throw error;
      }

      if (isNotFoundError(error)) {
        return undefined;
      }

      throw new ConfigReadError({
        message: "Unable to load config file",
        cause: error,
      });
    }
  }

  private searchPlaces(filePatterns: readonly string[]): string[] {
    return filePatterns.length > 0 ? [...filePatterns] : [...defaultFilePatterns];
  }
}

function parseInlineYaml(request: Extract<ConfigLoadRequest, { content: string }>): LoadedConfig {
  return {
    format: "yaml",
    source: {
      type: "inline",
      name: request.name,
    },
    value: loadYaml(request.name ?? "<inline>", request.content),
  };
}

function loadYaml(_filepath: string, content: string): unknown {
  const parsedDocument = parseDocument(content);

  if (parsedDocument.errors.length > 0) {
    throw new ConfigParseError(
      parsedDocument.errors.map((error) => ({
        path: [],
        message: error.message,
        code: "YAML_PARSE_ERROR",
      })),
    );
  }

  return parsedDocument.toJS();
}

function findMatchedPattern(filePath: string, searchRoot: string | undefined, searchPlaces: readonly string[]): string | undefined {
  if (!searchRoot) {
    return undefined;
  }

  const relativePath = relative(searchRoot, filePath);

  return searchPlaces.find((searchPlace) => searchPlace === relativePath);
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT",
  );
}
