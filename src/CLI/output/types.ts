import type { ParsedArgs } from "../arguments/index.js";

/** What a command's result is turned into. */
export interface Output {
  print(command: ParsedArgs["command"], result: unknown): string;
}

/** One command's result in the words that command has of its own. */
export interface CommandText<TResult> {
  print(result: TResult): string;
}
