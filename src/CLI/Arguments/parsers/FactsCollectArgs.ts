import type { FactsCollectArgs, SubcommandArgsParser } from "../types.js";
import { CommandArguments, runtimeArgsIn, runtimeOptions } from "./CommandArguments.js";

/**
 * `openstrap facts collect host`.
 *
 * There is nothing to parameterise. The command reads the machine as it is, so it takes
 * no file to read questions from and no values to fill one in with.
 */
export class FactsCollectArgsParser implements SubcommandArgsParser {
  readonly subcommand = "collect";

  parse(args: readonly string[]): FactsCollectArgs {
    const read = new CommandArguments(args, {
      ...runtimeOptions,
      flags: ["json"],
    });

    if (read.positionals[0] !== "host") {
      throw new Error("Missing facts target. Use: openstrap facts collect host");
    }

    if (read.positionals.length > 1) {
      throw new Error(`Unexpected argument "${read.positionals[1]}". Use: openstrap facts collect host`);
    }

    return {
      command: "facts.collect",
      target: "host",
      json: read.flag("json"),
      ...runtimeArgsIn(read),
    };
  }
}
