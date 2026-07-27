export type RuntimeArgs = {
  runtimeConfigPath?: string;
  pluginSpecifiers: string[];
  factsBackendId?: string;
};

export type RunArgs = {
  command: "run";
  configPath?: string;
  json: boolean;
} & RuntimeArgs;

export type FactsCollectArgs = {
  command: "facts.collect";
  target: "host";
  configPath: string;
  json: boolean;
  inputs: Record<string, string>;
} & RuntimeArgs;

export type CreateArgs = {
  command: "create";
  kind: "vm";
  target: string;
  configPath?: string;
  hostPort?: number;
  json: boolean;
} & RuntimeArgs;

export type ParsedArgs = RunArgs | FactsCollectArgs | CreateArgs;
