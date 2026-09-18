import type { CommandArgsParser, RemoveArgs } from "../types.js";
import { CommandArguments } from "../CommandArguments.js";

export class RemoveArgsParser implements CommandArgsParser {
  readonly command = "remove";

  parse(args: readonly string[]): RemoveArgs {
    const read = new CommandArguments(args, {
      ...CommandArguments.runtimeOptions,
      flags: [...(CommandArguments.runtimeOptions.flags ?? []), "json", "force"],
    });
    const [target, ...extra] = read.positionals;

    if (target === undefined || extra.length > 0) {
      throw new Error("Usage: openstrap remove <target> [--force]");
    }

    return {
      command: "remove",
      target,
      force: read.flag("force"),
      json: read.flag("json"),
      ...CommandArguments.runtimeArgsIn(read),
    };
  }
}
