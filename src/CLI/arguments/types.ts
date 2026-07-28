import type { FactOrder } from "../../Modules/Facts/Facts.js";

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
  json: boolean;
  /**
   * What to read, what to call it, and which channel reached it.
   *
   * Absent when a person asked: then it is this machine, everything is read, and no channel was
   * opened. Present when openstrap was started by openstrap on a machine it delivered itself to,
   * which is the only caller that knows the target by a name the machine itself cannot know.
   */
  order?: FactOrder;
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
