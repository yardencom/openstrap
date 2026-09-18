import type { OpenStrapRuntime } from "../../Plugin/index.js";
import type { ParsedArgs } from "../arguments/types.js";

/** What a command is told about the invocation, beyond its own arguments. */
export type CommandContext = {
  workspaceRoot: string;
  now?: Date;
  /**
   * The plugins this invocation has, loaded before any command runs — they decide which words the command
   * line even has.
   */
  runtime(): Promise<OpenStrapRuntime>;
};

/** What a command produces, and what its outcome means for the process. */
export type CommandOutcome<TResult> = {
  result: TResult;
  exitCode: number;
};

/** One command of the command line. */
export interface CliCommand<TArgs extends ParsedArgs, TResult> {
  execute(args: TArgs, context: CommandContext): Promise<CommandOutcome<TResult>>;
}
