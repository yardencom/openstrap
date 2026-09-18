import type { CommandArgsParser, LoginArgs } from "../types.js";
import { CommandArguments } from "../CommandArguments.js";

/**
 * `openstrap login` — a person, signed in.
 *
 * Takes nothing: a password would be a password to keep somewhere, and a token pasted in is a token
 * in a shell's history. openstrap shows a code, the person types it where they already are signed
 * in, and openstrap waits.
 */
export class LoginArgsParser implements CommandArgsParser {
  readonly command = "login";

  parse(args: readonly string[]): LoginArgs {
    const read = new CommandArguments(args, {
      ...CommandArguments.runtimeOptions,
      flags: [...(CommandArguments.runtimeOptions.flags ?? []), "json", "forget"],
    });

    if (read.positionals.length > 0) {
      throw new Error("Usage: openstrap login   (or: openstrap login --forget)");
    }

    return {
      command: "login",
      forget: read.flag("forget"),
      json: read.flag("json"),
      ...CommandArguments.runtimeArgsIn(read),
    };
  }
}
