import { CliUsageError } from "./arguments/index.js";

export class CliErrors {
  /**
   * @param usage One line per command the run has, which is not a list openstrap can write down:
   * the commands are whatever the plugins in force registered, its own among them.
   */
  constructor(private readonly commandUsage: readonly string[] = []) {}

  /**
   * How an error reads on the command line.
   *
   * A mistyped command line is followed by what is on offer; anything else is not, because
   * a machine that would not answer is not a question of syntax and the usage would bury
   * the reason.
   */
  format(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    return error instanceof CliUsageError ? `${message}\n\n${this.usage()}` : message;
  }

  private usage(): string {
    return ["Usage:", ...this.commandUsage.map((line) => `  ${line}`)].join("\n");
  }
}
