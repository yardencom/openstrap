import type { CommandArgsParser, RunArgs } from "../types.js";
import { CommandArguments } from "../CommandArguments.js";

export class RunArgsParser implements CommandArgsParser {
  readonly command = "run";

  parse(args: readonly string[]): RunArgs {
    const read = new CommandArguments(args, {
      ...CommandArguments.runtimeOptions,
      values: [...CommandArguments.runtimeOptions.values ?? [], "host-port"],
      flags: [...(CommandArguments.runtimeOptions.flags ?? []), "json"],
    });

    if (read.positionals.length > 1) {
      throw new Error("Only one config path can be provided");
    }

    return {
      command: "run",
      configPath: read.positionals[0],
      hostPort: CommandArguments.hostPortIn(read.value("host-port")),
      json: read.flag("json"),
      ...CommandArguments.runtimeArgsIn(read),
    };
  }
}
