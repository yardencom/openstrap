/**
 * A result in the words it is read by.
 *
 * One per command for the words that command has of its own, and one more for JSON, which
 * reads any result at all. They are not two kinds of thing: `--json` is another way of
 * saying a result, not another mechanism for saying it.
 */
export interface CommandText<TResult> {
  describe(result: TResult): string;
}
