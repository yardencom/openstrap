import { CliUsageError } from "./arguments/index.js";

export class CliErrors {
  /**
   * @param usage One line per command the run has, which is not a list openstrap can write down: the commands
   * are whatever the plugins in force registered, its own among them.
   */
  constructor(private readonly commandUsage: readonly string[] = []) {}

  /** A mistyped command line is followed by the usage; anything else is not, or it buries the reason. */
  format(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    return error instanceof CliUsageError ? `${message}\n\n${this.usage()}` : message;
  }

  private usage(): string {
    return ["Usage:", ...this.commandUsage.map((line) => `  ${line}`)].join("\n");
  }
}
