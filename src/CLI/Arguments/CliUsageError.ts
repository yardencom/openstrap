/**
 * The command line was wrong.
 *
 * A separate kind because it is the one error the usage should be printed after: the caller
 * mistyped something and needs to see what is on offer. Which errors those are is known by
 * the parser and by nothing else, so it says so here rather than leaving the answer to be
 * inferred from where in `main` the throw happened to land.
 */
export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}
