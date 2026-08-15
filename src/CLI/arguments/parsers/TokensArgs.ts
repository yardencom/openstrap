import type { CommandArgsParser, TokensArgs } from "../types.js";
import { CommandArguments } from "../CommandArguments.js";

/**
 * `openstrap tokens` — the passes an organization's machines hold.
 *
 * `issue <name>` makes one for something that cannot sign in at all — an agent, a CI job — and is
 * the only way such a thing gets one: a person who is already signed in makes it and puts it where
 * that thing will look. `revoke <id>` takes one back.
 */
export class TokensArgsParser implements CommandArgsParser {
  readonly command = "tokens";

  parse(args: readonly string[]): TokensArgs {
    const read = new CommandArguments(args, {
      ...CommandArguments.runtimeOptions,
      flags: [...(CommandArguments.runtimeOptions.flags ?? []), "json"],
    });
    const [word, subject] = read.positionals;

    if (word !== undefined && word !== "issue" && word !== "revoke") {
      throw new Error(`Unknown word "${word}". Usage: openstrap tokens [issue <name> | revoke <id>]`);
    }

    if (word !== undefined && !subject) {
      throw new Error(`openstrap tokens ${word} needs ${word === "issue" ? "a name" : "an id"}`);
    }

    return {
      command: "tokens",
      did: word ?? "list",
      subject,
      json: read.flag("json"),
      ...CommandArguments.runtimeArgsIn(read),
    };
  }
}
