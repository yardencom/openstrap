import type { ParsedArgs } from "./CliArgs.js";

export interface CliCommandArgsParser {
  readonly command: string;
  parse(args: readonly string[]): ParsedArgs;
}
