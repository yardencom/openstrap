import type { CommandArgsParser, SecretArgs } from "../types.js";
import { CommandArguments } from "../CommandArguments.js";

export class SecretArgsParser implements CommandArgsParser {
  readonly command = "secret";

  parse(args: readonly string[]): SecretArgs {
    const read = new CommandArguments(args, {
      ...CommandArguments.runtimeOptions,
      flags: [...(CommandArguments.runtimeOptions.flags ?? []), "json"],
    });
    const [word, name, ...extra] = read.positionals;

    if (extra.length > 0) {
      throw new Error(
        `openstrap secret ${word} takes only a name. The value is never an argument, because arguments land in the shell's `
        + "history: run the command with the name alone and it will ask for the value, or pipe the value in.",
      );
    }

    if (word !== "set" && word !== "forget") {
      throw new Error(`Usage: openstrap secret <set|forget> <name>${word === undefined ? "" : `. "${word}" is neither.`}`);
    }

    if (!name) {
      throw new Error(`openstrap secret ${word} needs the name of the secret, as the blueprint spells it`);
    }

    return {
      command: "secret",
      did: word,
      name,
      json: read.flag("json"),
      ...CommandArguments.runtimeArgsIn(read),
    };
  }
}
