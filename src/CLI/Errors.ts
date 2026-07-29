import { OpenStrapPluginError } from "../Plugin/index.js";
import { CliUsageError } from "./arguments/index.js";

export class CliErrors {
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
    return [
      "Usage:",
      "  openstrap run [configPath] [--json] [--runtime-config path] [--plugin specifier]",
      "  openstrap create vm <target> [--config path] [--host-port n] [--json] [--plugin specifier]",
      "  openstrap connect <target> [--run command] [--plugin specifier]",
      "  openstrap facts collect <host|target> [--json] [--plugin specifier]",
    ].join("\n");
  }
}
