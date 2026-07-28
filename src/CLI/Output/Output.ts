import type { CommandOutcome } from "../application/CliCommand.js";
import type { CommandText } from "./CommandText.js";

/**
 * What is done with a command's result.
 *
 * One question — how is this read out — and one method to answer it. The command's own words
 * arrive as something to ask for rather than something already built, so an implementation
 * that does not need them never makes them.
 *
 * Reading a result out turns an outcome into an outcome: the result becomes the text, and the
 * exit code passes through untouched, because what a result means is the command's judgement
 * and no way of reading it has anything to say about that.
 */
export interface Output {
  read<TResult>(
    outcome: CommandOutcome<TResult>,
    words: () => CommandText<TResult>,
  ): CommandOutcome<string>;
}

/**
 * The result as a program reads it: the thing itself, indented, one trailing newline.
 *
 * The same for every command, because JSON of a result is the result — which is why the
 * command's own words are never asked for here.
 */
export class JsonOutput implements Output {
  read<TResult>(outcome: CommandOutcome<TResult>): CommandOutcome<string> {
    return {
      result: `${JSON.stringify(outcome.result, null, 2)}\n`,
      exitCode: outcome.exitCode,
    };
  }
}

/** The result as a person reads it, in the command's own words. */
export class TextOutput implements Output {
  read<TResult>(
    outcome: CommandOutcome<TResult>,
    words: () => CommandText<TResult>,
  ): CommandOutcome<string> {
    return {
      result: words().describe(outcome.result),
      exitCode: outcome.exitCode,
    };
  }
}
