import type { OpenStrapRuntime } from "../../Plugin/index.js";
import type { ParsedArgs } from "../arguments/types.js";

/** What a command is told about the invocation, beyond its own arguments. */
export type CommandContext = {
  workspaceRoot: string;
  now?: Date;
  /**
   * The plugins this invocation has.
   *
   * Already loaded by the time any command runs, because which words the command line even has is
   * decided by the plugins: openstrap looks the first word up among the commands they registered.
   * Still a function, so a command that has no use for a plugin never asks and the shape stays the
   * one a command written against it expects.
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
