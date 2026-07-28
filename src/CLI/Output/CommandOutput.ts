import type { CommandOutcome } from "../application/CliCommand.js";
import type { CommandText } from "./CommandText.js";

/** What a command line answers with: something to print, and how the process should end. */
export type Answer = {
  output: string;
  exitCode: number;
};

/**
 * How a command's result is presented.
 *
 * One question — what does this result look like — and one method to answer it. Both
 * implementations are handed the outcome and the words that result reads by, and which of
 * the two matters is the entire difference between them. Adding a command touches neither.
 */
export interface CommandOutput {
  present<TResult>(outcome: CommandOutcome<TResult>, text: CommandText<TResult>): Answer;
}

/**
 * The result as a program reads it: the thing itself, indented, one trailing newline.
 *
 * The same for every command, because JSON of a result is the result — which is why the
 * words are ignored here.
 */
export class JsonOutput implements CommandOutput {
  present<TResult>(outcome: CommandOutcome<TResult>): Answer {
    return {
      output: `${JSON.stringify(outcome.result, null, 2)}\n`,
      exitCode: outcome.exitCode,
    };
  }
}

/** The result as a person reads it, in the command's own words. */
export class TextOutput implements CommandOutput {
  present<TResult>(outcome: CommandOutcome<TResult>, text: CommandText<TResult>): Answer {
    return {
      output: text.of(outcome.result),
      exitCode: outcome.exitCode,
    };
  }
}
