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

/** What a command leaves behind: something to print, and how the process should end. */
export type CommandOutcome = {
  output: string;
  exitCode: number;
};

/**
 * One command of the command line.
 *
 * Every command decides everything about itself: what it does, how its result reads,
 * and what its outcome means for the exit code. The dispatcher only picks which one
 * runs — it cannot render, and it cannot judge, because a command that needed the
 * dispatcher's help with either would have put its own rules somewhere else.
 */
export interface CliCommand<TArgs extends ParsedArgs> {
  execute(args: TArgs, context: CommandContext): Promise<CommandOutcome>;
}

/**
 * The result as the caller asked to see it.
 *
 * `--json` prints the result itself rather than the rendered form, so anything
 * openstrap can say a person can also parse. The rendering is a callback because it
 * costs work nobody wants done when the answer is going to a program.
 */
export function printedAs(asJson: boolean, result: unknown, render: () => string): string {
  return asJson ? `${JSON.stringify(result, null, 2)}\n` : render();
}
