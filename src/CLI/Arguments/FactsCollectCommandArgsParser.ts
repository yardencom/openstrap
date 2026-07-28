import type { FactsCollectArgs } from "./CliArgs.js";
import type { FactsSubcommandArgsParser } from "./FactsSubcommandArgsParser.js";
import { RuntimeArgsParser } from "./RuntimeArgsParser.js";

/**
 * `openstrap facts collect host`.
 *
 * There is nothing to parameterise. The command reads the machine as it is, so it
 * takes no file to read questions from and no values to fill one in with.
 */
export class FactsCollectCommandArgsParser implements FactsSubcommandArgsParser {
  readonly subcommand = "collect";

  constructor(private readonly runtimeArgs = new RuntimeArgsParser()) {}

  parse(args: readonly string[]): FactsCollectArgs {
    let json = false;
    const positionals: string[] = [];
    const runtimeArgs = this.runtimeArgs.create();

    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index]!;
      const runtimeOptionIndex = this.runtimeArgs.readOption(arg, args, index, runtimeArgs);

      if (runtimeOptionIndex !== undefined) {
        index = runtimeOptionIndex;
        continue;
      }

      if (arg === "--json") {
        json = true;
        continue;
      }

      if (arg.startsWith("-")) {
        throw new Error(`Unknown option "${arg}"`);
      }

      positionals.push(arg);
    }

    if (positionals[0] !== "host") {
      throw new Error("Missing facts target. Use: openstrap facts collect host");
    }

    if (positionals.length > 1) {
      throw new Error(`Unexpected argument "${positionals[1]}". Use: openstrap facts collect host`);
    }

    return {
      command: "facts.collect",
      target: "host",
      json,
      ...runtimeArgs,
    };
  }
}
