import type { CommandText } from "./CommandText.js";

/**
 * A result as a program reads it: the thing itself, indented, one trailing newline.
 *
 * The same for every command, because JSON of a result is the result. Nothing about it is
 * per command, which is why one class serves them all.
 */
export class JsonText<TResult> implements CommandText<TResult> {
  describe(result: TResult): string {
    return `${JSON.stringify(result, null, 2)}\n`;
  }
}
