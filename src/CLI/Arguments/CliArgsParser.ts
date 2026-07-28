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
      throw new Error("Missing command");
    }

    const parser = this.commandParsers.find((candidate) => candidate.command === command);

    if (!parser) {
      throw new Error(`Unknown command "${command}"`);
    }

    return parser.parse(args);
  }
}
