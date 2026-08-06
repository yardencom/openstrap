import type { CommandArgsParser, ConvergeArgs } from "../types.js";
import { CommandArguments, runtimeArgsIn, runtimeOptions } from "../CommandArguments.js";

/**
 * `openstrap converge <host|target> [--check] [--max-passes n]`.
 *
 * The machine is named for the same reason it is named when facts are collected: `host` is the
 * machine openstrap is running on, and any other name is one it created and reaches by delivering
 * itself there. Converging changes a machine, so guessing which one is not a thing to be forgiven.
 *
 * What has to be true and how it is made true are not arguments. Both are written in the blueprint
 * of the directory the command was run in — the requirement and the step that answers it, side by
 * side — because that is a document that can be read, reviewed and committed, and a command line is
 * none of those.
 */
export class ConvergeArgsParser implements CommandArgsParser {
  readonly command = "converge";

  parse(args: readonly string[]): ConvergeArgs {
    const read = new CommandArguments(args, {
      ...runtimeOptions,
      flags: ["json", "check"],
      values: [...(runtimeOptions.values ?? []), "max-passes"],
    });
    const named = read.positionals[0];

    if (named === undefined) {
      throw new Error("Missing machine. Use: openstrap converge <host|target>");
    }

    if (read.positionals.length > 1) {
      throw new Error(`Unexpected argument "${read.positionals[1]}". Use: openstrap converge <host|target>`);
    }

    return {
      command: "converge",
      target: named,
      check: read.flag("check"),
      maxPasses: passes(read.value("max-passes")),
      json: read.flag("json"),
      ...runtimeArgsIn(read),
    };
  }
}

function passes(given: string | undefined): number | undefined {
  if (given === undefined) {
    return undefined;
  }

  const bound = Number(given);

  if (!Number.isInteger(bound) || bound < 1) {
    throw new Error(`--max-passes must be a whole number of at least 1, not "${given}"`);
  }

  return bound;
}
