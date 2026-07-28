import type { CommandArgsParser, RunArgs } from "../types.js";
import { CommandArguments, runtimeArgsIn, runtimeOptions } from "../CommandArguments.js";

export class RunArgsParser implements CommandArgsParser {
  readonly command = "run";

  parse(args: readonly string[]): RunArgs {
    const read = new CommandArguments(args, {
      ...runtimeOptions,
      flags: ["json"],
    });

    if (read.positionals.length > 1) {
      throw new Error("Only one config path can be provided");
    }

    return {
      command: "run",
      configPath: read.positionals[0],
      json: read.flag("json"),
      ...runtimeArgsIn(read),
    };
  }
}
