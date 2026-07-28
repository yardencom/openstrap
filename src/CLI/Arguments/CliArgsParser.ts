import { CliUsageError } from "./CliUsageError.js";
import type { CommandArgsParser, ParsedArgs } from "./types.js";
import { ConnectArgsParser } from "./parsers/ConnectArgs.js";
import { CreateArgsParser } from "./parsers/CreateArgs.js";
import { FactsArgsParser } from "./FactsArgsParser.js";
import { RunArgsParser } from "./parsers/RunArgs.js";

/**
 * The first word of the command line decides who reads the rest.
 *
 * Every parser names the word it answers to, so adding a command is adding a parser
 * here and nothing else.
 */
export class CliArgsParser {
  constructor(
    private readonly commandParsers: readonly CommandArgsParser[] = [
      new RunArgsParser(),
      new FactsArgsParser(),
      new CreateArgsParser(),
      new ConnectArgsParser(),
    ],
  ) {}

  parse(argv: readonly string[]): ParsedArgs {
    const [, , command, ...args] = argv;

    if (!command) {
      throw new CliUsageError("Missing command");
    }

    const parser = this.commandParsers.find((candidate) => candidate.command === command);

    if (!parser) {
      throw new CliUsageError(`Unknown command "${command}"`);
    }

    // Everything a parser rejects is the command line being wrong, so it all reads the
    // same way to the caller: the complaint, then what is on offer.
    try {
      return parser.parse(args);
    } catch (error) {
      throw error instanceof CliUsageError
        ? error
        : new CliUsageError(error instanceof Error ? error.message : String(error));
    }
  }
}
