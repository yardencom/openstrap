import type { CommandArgsParser, ParsedArgs, SubcommandArgsParser } from "../types.js";
import { FactsCollectArgsParser } from "./FactsCollectArgs.js";

export class FactsArgsParser implements CommandArgsParser {
  readonly command = "facts";

  constructor(
    private readonly subcommandParsers: readonly SubcommandArgsParser[] = [
      new FactsCollectArgsParser(),
    ],
  ) {}

  parse(args: readonly string[]): ParsedArgs {
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
