import type { FactsCollectArgs, SubcommandArgsParser } from "../types.js";
import { CommandArguments, runtimeArgsIn, runtimeOptions } from "../CommandArguments.js";

/**
 * `openstrap facts collect <host|target> [--full]`.
 *
 * The machine has to be named, because there is more than one it could be: `host` is the machine
 * openstrap is running on, and any other name is a target it created, which it reaches by delivering
 * itself there. A command that guessed would read the wrong machine and say nothing about it.
 *
 * What to read is not an argument. A blueprint in the directory the command was run in decides it,
 * and `--full` overrides that with "all of it". There used to be an `--order` carrying a whole
 * declaration as base64, which existed so openstrap could drive openstrap over a channel; that is a
 * blueprint on the other machine now, so the flag is gone and there is one way to say this.
 */
export class FactsCollectArgsParser implements SubcommandArgsParser {
  readonly subcommand = "collect";

  parse(args: readonly string[]): FactsCollectArgs {
    const read = new CommandArguments(args, {
      ...runtimeOptions,
      flags: ["json", "full"],
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
      ...runtimeArgsIn(read),
    };
  }
}
