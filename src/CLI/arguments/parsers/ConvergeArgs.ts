import type { CommandArgsParser, ConvergeArgs } from "../types.js";
import { CommandArguments } from "../CommandArguments.js";

/** `openstrap converge <host|target> [--check] [--max-passes n]`. */
export class ConvergeArgsParser implements CommandArgsParser {
  readonly command = "converge";

  parse(args: readonly string[]): ConvergeArgs {
    const read = new CommandArguments(args, {
      ...CommandArguments.runtimeOptions,
      flags: [...(CommandArguments.runtimeOptions.flags ?? []), "json", "check"],
      values: [...(CommandArguments.runtimeOptions.values ?? []), "max-passes"],
    });
    const named = read.positionals[0];

    if (named === undefined) {
      throw new Error("Missing machine. Use: openstrap converge <host|target>");
    }

    if (read.positionals.length > 1) {
      throw new Error(`Unexpected argument "${read.positionals[1]}". Use: openstrap converge <host|target>`);
    }

    return {
      command: "converge",
      target: named,
      check: read.flag("check"),
      maxPasses: ConvergeArgsParser.passes(read.value("max-passes")),
      json: read.flag("json"),
      ...CommandArguments.runtimeArgsIn(read),
    };
  }

  private static passes(given: string | undefined): number | undefined {
    if (given === undefined) {
      return undefined;
    }

    const bound = Number(given);

    if (!Number.isInteger(bound) || bound < 1) {
      throw new Error(`--max-passes must be a whole number of at least 1, not "${given}"`);
    }

    return bound;
  }
}
