/** The command line was wrong: the one error the usage should follow. */
export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}
