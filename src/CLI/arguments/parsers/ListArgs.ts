import type { CommandArgsParser, ListArgs } from "../types.js";
import { CommandArguments } from "../CommandArguments.js";

export class ListArgsParser implements CommandArgsParser {
  readonly command = "list";

  parse(args: readonly string[]): ListArgs {
    const read = new CommandArguments(args, {
      ...CommandArguments.runtimeOptions,
      flags: [...(CommandArguments.runtimeOptions.flags ?? []), "json"],
    });

    if (read.positionals.length > 0) {
      throw new Error("Usage: openstrap list");
    }

    return {
      command: "list",
      json: read.flag("json"),
      ...CommandArguments.runtimeArgsIn(read),
    };
  }
}
