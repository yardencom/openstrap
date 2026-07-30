/**
 * What a command is told about the invocation, beyond its own arguments.
 *
 * Deliberately small. A command that needs a machine created or reached will need more than this,
 * and what exactly it is handed then is a decision about the boundary — openstrap's registries are
 * openstrap's, and a plugin that held them would be holding the core. Until that is decided, a
 * plugin command gets where it was run and when.
 */
export type OpenStrapCommandContext = {
  /** The directory openstrap was run in, which is where a project's own files are. */
  workspaceRoot: string;
  now?: Date;
};

export type OpenStrapCommandOutcome<TResult> = {
  result: TResult;
  /** What the command's result means for the process. Only the command knows. */
  exitCode: number;
};

/**
 * One word of the command line, and everything that word means.
 *
 * A command brings its own three things, because openstrap cannot know any of them about a command
 * it did not write: how to read the rest of the arguments, what to do, and how the result reads to
 * a person. `--json` is not among them — that is a question about presentation, and the answer is
 * the same for every command.
 *
 * `name` is the first word only. Everything after it is the command's own to read, so a plugin is
 * free to have subcommands of its own without asking openstrap for anything:
 *
 *     openstrap workloads run ./manifest.yaml
 *              ^^^^^^^^^ name  ^^^^^^^^^^^^^^^^^^^^^ the command parses this
 */
export type OpenStrapCommand<TArgs = unknown, TResult = unknown> = {
  name: string;
  /** One line, as it appears in the usage openstrap prints when a command line is wrong. */
  usage: string;
  parse(args: readonly string[]): TArgs;
  execute(args: TArgs, context: OpenStrapCommandContext): Promise<OpenStrapCommandOutcome<TResult>>;
  text(result: TResult): string;
};
