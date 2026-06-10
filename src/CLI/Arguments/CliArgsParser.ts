import type { ParsedArgs } from "./CliArgs.js";
import type { CliCommandArgsParser } from "./CliCommandArgsParser.js";
import { FactsCommandArgsParser } from "./FactsCommandArgsParser.js";
import { RunCommandArgsParser } from "./RunCommandArgsParser.js";

export class CliArgsParser {
  constructor(
    private readonly commandParsers: readonly CliCommandArgsParser[] = [
      new RunCommandArgsParser(),
      new FactsCommandArgsParser(),
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
