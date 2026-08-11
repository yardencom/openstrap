import type { CommandArgsParser, ConnectArgs } from "../types.js";
import { CommandArguments } from "../CommandArguments.js";

export class ConnectArgsParser implements CommandArgsParser {
  readonly command = "connect";

  parse(args: readonly string[]): ConnectArgs {
    const read = new CommandArguments(args, {
      ...CommandArguments.runtimeOptions,
      values: [...(CommandArguments.runtimeOptions.values ?? []), "run"],
    });
    const [target] = read.positionals;

    if (!target) {
      throw new Error("Usage: openstrap connect <target>");
    }

    if (read.positionals.length > 1) {
      throw new Error("Only one target can be connected to at a time");
    }

    return {
      command: "connect",
      target,
      run: read.value("run"),
      ...CommandArguments.runtimeArgsIn(read),
    };
  }
}
