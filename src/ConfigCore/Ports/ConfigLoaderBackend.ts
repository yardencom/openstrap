import type { ConfigFormat } from "../Domain/ConfigFormat.js";

export type ConfigLoadRequest =
  | {
      content: string;
      name?: string;
    }
  | {
      path: string;
    }
  | {
      searchRoot: string;
    }
  | {
      user: true;
    }
  | {
      explicitPath?: string;
      workspaceRoot: string;
      includeUser?: boolean;
    };

export type LoadedConfigSource =
  | {
      type: "inline";
      name?: string;
    }
  | {
      type: "file";
      scope: "explicit" | "workspace" | "user";
      path: string;
      format: ConfigFormat;
      matchedPattern?: string;
      searchRoot?: string;
    };

export type LoadedConfig = {
  format: ConfigFormat;
  value: unknown;
  source?: LoadedConfigSource;
};

export type ConfigLoaderBackendRequest = ConfigLoadRequest & {
  filePatterns: readonly string[];
};

export interface ConfigLoaderBackend {
  load(request: ConfigLoaderBackendRequest): LoadedConfig | undefined;
}
