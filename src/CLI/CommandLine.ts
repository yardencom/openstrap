import type { ParsedArgs } from "./Arguments/index.js";
import type { CommandOutput } from "./Output/CommandOutput.js";
import type { CliCommand, CommandContext } from "./application/CliCommand.js";

/** What a command line answers with: something to print, and how the process should end. */
export type Answer = {
  output: string;
  exitCode: number;
};

/**
 * One invocation of openstrap: a context to run a command in, and a way to present what
 * it produced.
 *
 * Both are fixed for the whole invocation, so they are settled once here rather than
 * threaded through every command that is selected. What each command adds is only what
 * differs: itself, its arguments, and how its result reads.
 */
export class CommandLine {
  constructor(
    private readonly context: CommandContext,
    private readonly output: CommandOutput,
  ) {}

  /** Runs the command, presents its result, keeps its exit code. */
  async answer<TArgs extends ParsedArgs, TResult>(
    command: CliCommand<TArgs, TResult>,
    args: TArgs,
    asText: (result: TResult) => string,
  ): Promise<Answer> {
    const { result, exitCode } = await command.execute(args, this.context);

    return { output: this.output.present(result, asText), exitCode };
  }
}
