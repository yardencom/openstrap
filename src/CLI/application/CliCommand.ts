import type { OpenStrapRuntime } from "../../Plugin/index.js";
import type { ParsedArgs } from "../Arguments/types.js";

/** What a command is told about the invocation, beyond its own arguments. */
export type CommandContext = {
  workspaceRoot: string;
  now?: Date;
  /**
   * The plugins this invocation asked for.
   *
   * A function rather than a value, because only the commands that create or reach a
   * machine need one: loading a plugin runs its module, and `run` and `facts collect`
   * read the machine openstrap is on, where nothing is pluggable.
   */
  runtime(): Promise<OpenStrapRuntime>;
};

/** What a command produces, and what its outcome means for the process. */
export type CommandOutcome<TResult> = {
  result: TResult;
  exitCode: number;
};

/**
 * One command of the command line.
 *
 * A command does its work and says what came of it. It does not know whether the answer
 * is going to be read by a person or by a program, and it must not: `--json` is a
 * question about presentation, and a command that answered it would be deciding how it
 * looks as well as what it is.
 *
 * The exit code is the command's own, because only the command knows what its result
 * means. Turning a result into text is somebody else's job entirely.
 */
export interface CliCommand<TArgs extends ParsedArgs, TResult> {
  execute(args: TArgs, context: CommandContext): Promise<CommandOutcome<TResult>>;
}
