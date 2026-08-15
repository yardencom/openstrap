import type { CommandArgsParser, LoginArgs } from "../types.js";
import { CommandArguments } from "../CommandArguments.js";

/**
 * `openstrap login` — what a person signed in with, read from what was piped in.
 *
 * Never from an argument: what is typed on a command line is in the shell's history afterwards, and
 * a credential in a history file is one somebody else can have.
 */
export class LoginArgsParser implements CommandArgsParser {
  readonly command = "login";

  parse(args: readonly string[]): LoginArgs {
    const read = new CommandArguments(args, {
      ...CommandArguments.runtimeOptions,
      flags: [...(CommandArguments.runtimeOptions.flags ?? []), "json", "forget"],
    });

    if (read.positionals.length > 0) {
      throw new Error("Usage: openstrap login < credential-file   (or: openstrap login --forget)");
    }

    return {
      command: "login",
      forget: read.flag("forget"),
      json: read.flag("json"),
      ...CommandArguments.runtimeArgsIn(read),
    };
  }
}
