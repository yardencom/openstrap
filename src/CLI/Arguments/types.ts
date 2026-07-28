/**
 * The arguments each command takes, once read.
 *
 * `command` discriminates the union, so a caller that switches on it is told by the
 * compiler when a command is added and not handled.
 */
export type RuntimeArgs = {
  runtimeConfigPath?: string;
  pluginSpecifiers: string[];
};

export type RunArgs = {
  command: "run";
  configPath?: string;
  json: boolean;
} & RuntimeArgs;

export type FactsCollectArgs = {
  command: "facts.collect";
  target: "host";
  json: boolean;
} & RuntimeArgs;

export type CreateArgs = {
  command: "create";
  kind: "vm";
  target: string;
  configPath?: string;
  hostPort?: number;
  json: boolean;
} & RuntimeArgs;

export type ConnectArgs = {
  command: "connect";
  target: string;
  run?: string;
} & RuntimeArgs;

export type ParsedArgs = RunArgs | FactsCollectArgs | CreateArgs | ConnectArgs;

/** A parser for one command word: `run`, `create`, `connect`, `facts`. */
export interface CommandArgsParser {
  readonly command: string;
  parse(args: readonly string[]): ParsedArgs;
}

/** A parser for a word after a command: `collect` in `facts collect`. */
export interface SubcommandArgsParser {
  readonly subcommand: string;
  parse(args: readonly string[]): ParsedArgs;
}
