import type { FactsCollectArgs } from "./CliArgs.js";

export interface FactsSubcommandArgsParser {
  readonly subcommand: string;
  parse(args: readonly string[]): FactsCollectArgs;
}
