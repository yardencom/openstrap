/** The arguments each command takes, once read. */
export type RuntimeArgs = {
  /**
   * Keep this run to this machine, whatever the environment says.
   *
   * A server is the record for everything an organization has, and one run wanting to stay out of
   * that is a decision made at the moment of running — not a variable somebody has to remember to
   * unset and then remember to set back.
   */
  local: boolean;
  runtimeConfigPath?: string;
  pluginSpecifiers: string[];
};

export type RunArgs = {
  command: "run";
  configPath?: string;
  /** Where to start looking for a free host port, for targets a run has to create. */
  hostPort?: number;
  json: boolean;
} & RuntimeArgs;

export type FactsCollectArgs = {
  command: "facts.collect";
  /** Read the machine entire, even where a blueprint would have narrowed it. */
  full: boolean;
  /** `host` is the machine openstrap is running on; anything else is a target it created. */
  target: string;
  json: boolean;
} & RuntimeArgs;

export type CreateArgs = {
  command: "create";
  kind: "vm";
  target: string;
  /** Which operating system to make it of, where no blueprint declares this machine. */
  os?: string;
  /** Which hypervisor makes it, where more than one plugin could. */
  provider?: string;
  configPath?: string;
  hostPort?: number;
  /** Moves the image pin to whatever the target's image name resolves to now. */
  repin: boolean;
  json: boolean;
} & RuntimeArgs;

export type ConvergeArgs = {
  command: "converge";
  /** `host` is the machine openstrap is running on; anything else is a target it created. */
  target: string;
  /** Work out what would be done, print it, and change nothing. */
  check: boolean;
  /** How many times to act before giving up. The feature's own bound unless this says otherwise. */
  maxPasses?: number;
  json: boolean;
} & RuntimeArgs;

export type ConnectArgs = {
  command: "connect";
  target: string;
  run?: string;
} & RuntimeArgs;

export type ListArgs = {
  command: "list";
  json: boolean;
} & RuntimeArgs;

export type ParsedArgs = RunArgs | FactsCollectArgs | CreateArgs | ConnectArgs | ConvergeArgs | ListArgs;

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
