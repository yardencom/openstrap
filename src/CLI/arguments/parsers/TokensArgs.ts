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
      values: [...(CommandArguments.runtimeOptions.values ?? []), "for"],
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
      expiresAt: TokensArgsParser.until(read.value("for")),
      json: read.flag("json"),
      ...CommandArguments.runtimeArgsIn(read),
    };
  }

  /**
   * When a pass stops working, as a date the server understands.
   *
   * Written as `30d`, `12h`, or a date. Absent is forever, and forever is a thing to decide rather
   * than to fall into: the server has checked `expires_at` on every request from the start, and
   * nothing could ever set it.
   */
  private static until(given: string | undefined): string | undefined {
    if (given === undefined) {
      return undefined;
    }

    const span = /^(\d+)([hd])$/.exec(given);

    if (span) {
      return new Date(Date.now() + Number(span[1]) * (span[2] === "d" ? 24 : 1) * 3600_000).toISOString();
    }

    const date = new Date(given);

    if (Number.isNaN(date.getTime())) {
      throw new Error(`--for wants a span like 30d or 12h, or a date. "${given}" is neither.`);
    }

    return date.toISOString();
  }
}
