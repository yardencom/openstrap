import type { FactOrder } from "../../../Modules/Facts/Facts.js";
import type { FactsCollectArgs, SubcommandArgsParser } from "../types.js";
import { CommandArguments, runtimeArgsIn, runtimeOptions } from "../CommandArguments.js";

/**
 * `openstrap facts collect [host]`.
 *
 * A person has nothing to fill in: the command reads this machine as it is, so it takes no file to
 * read questions from and no values to fill one in with.
 *
 * `--order` is how openstrap asks openstrap. Having delivered itself to a machine it cannot read from
 * here, it starts this same command over there, and has to say the three things that machine cannot
 * know: what the caller calls it, which sections were declared, and which channel reached it.
 */
export class FactsCollectArgsParser implements SubcommandArgsParser {
  readonly subcommand = "collect";

  parse(args: readonly string[]): FactsCollectArgs {
    const read = new CommandArguments(args, {
      ...runtimeOptions,
      flags: ["json"],
      values: [...(runtimeOptions.values ?? []), "order"],
    });
    const named = read.positionals[0];

    if (named !== undefined && named !== "host") {
      throw new Error(`Unexpected argument "${named}". Use: openstrap facts collect [host]`);
    }

    if (read.positionals.length > 1) {
      throw new Error(`Unexpected argument "${read.positionals[1]}". Use: openstrap facts collect [host]`);
    }

    return {
      command: "facts.collect",
      json: read.flag("json"),
      order: orderIn(read.value("order")),
      ...runtimeArgsIn(read),
    };
  }
}

/**
 * The order openstrap was started with, as base64 JSON.
 *
 * Encoded because it travels as one argument through whatever shell the transport uses to start a
 * process, and an encoding with no quotes, spaces or newlines cannot be reinterpreted on the way.
 *
 * The target is checked, because a snapshot named after nothing is a snapshot nobody can look up. The
 * rest is not: it was written by openstrap, and re-deciding it here would be a second implementation
 * of the same decisions.
 */
function orderIn(encoded: string | undefined): FactOrder | undefined {
  if (encoded === undefined) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("--order must be base64-encoded JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--order must decode to an order");
  }

  const order = parsed as FactOrder & { now?: string | Date };

  if (typeof order.target?.name !== "string" || order.target.name === "") {
    throw new Error("--order must name the target it is about");
  }

  // JSON carries no moment, only the text of one.
  return { ...order, now: order.now === undefined ? undefined : new Date(order.now) };
}
