import type { FactsCollectArgs, SubcommandArgsParser } from "../types.js";
import { CommandArguments } from "../CommandArguments.js";

/** `openstrap facts collect <host|target> [--full]`. */
export class FactsCollectArgsParser implements SubcommandArgsParser {
  readonly subcommand = "collect";

  parse(args: readonly string[]): FactsCollectArgs {
    const read = new CommandArguments(args, {
      ...CommandArguments.runtimeOptions,
      flags: [...(CommandArguments.runtimeOptions.flags ?? []), "json", "full"],
    });
    const named = read.positionals[0];

    if (named === undefined) {
      throw new Error("Missing machine. Use: openstrap facts collect <host|target>");
    }

    if (read.positionals.length > 1) {
      throw new Error(`Unexpected argument "${read.positionals[1]}". Use: openstrap facts collect <host|target>`);
    }

    return {
      command: "facts.collect",
      target: named,
      full: read.flag("full"),
      json: read.flag("json"),
      ...CommandArguments.runtimeArgsIn(read),
    };
  }
}
