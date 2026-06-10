import type { FactsCollectArgs } from "./CliArgs.js";
import type { CliCommandArgsParser } from "./CliCommandArgsParser.js";
import { FactsCollectCommandArgsParser } from "./FactsCollectCommandArgsParser.js";
import type { FactsSubcommandArgsParser } from "./FactsSubcommandArgsParser.js";

export class FactsCommandArgsParser implements CliCommandArgsParser {
  readonly command = "facts";

  constructor(
    private readonly subcommandParsers: readonly FactsSubcommandArgsParser[] = [
      new FactsCollectCommandArgsParser(),
    ],
  ) {}

  parse(args: readonly string[]): FactsCollectArgs {
    const [subcommand, ...rest] = args;

    if (!subcommand) {
      throw new Error("Missing facts command");
    }

    const parser = this.subcommandParsers.find((candidate) => candidate.subcommand === subcommand);

    if (!parser) {
      throw new Error(`Unknown facts command "${subcommand}"`);
    }

    return parser.parse(rest);
  }
}
