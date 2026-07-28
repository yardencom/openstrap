import type { ParsedArgs } from "../arguments/index.js";

/**
 * What a command's result is turned into.
 *
 * The command's name comes with the result because a result on its own does not say which command
 * produced it, and how it reads depends on that. An implementation that does not care ignores it.
 *
 * Nothing but the contracts live here: an implementation has to import them, so a file that also
 * chose between implementations would have to import those back.
 */
export interface Output {
  print(command: ParsedArgs["command"], result: unknown): string;
}

/**
 * One command's result in the words that command has of its own.
 *
 * What `TextOutput` is a strategy over: it decides which of these reads a given result, and each
 * of them knows how to say one thing.
 */
export interface CommandText<TResult> {
  print(result: TResult): string;
}
