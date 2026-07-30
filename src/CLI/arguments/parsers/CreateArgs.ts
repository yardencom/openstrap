import type { CommandArgsParser, CreateArgs } from "../types.js";
import { CommandArguments, runtimeArgsIn, runtimeOptions } from "../CommandArguments.js";

/** What openstrap knows how to create. */
const kinds = ["vm"] as const;

export class CreateArgsParser implements CommandArgsParser {
  readonly command = "create";

  parse(args: readonly string[]): CreateArgs {
    const read = new CommandArguments(args, {
      ...runtimeOptions,
      flags: ["json", "repin"],
      values: [...(runtimeOptions.values ?? []), "config", "host-port"],
    });
    const [kind, target] = read.positionals;

    if (!kind || !target) {
      throw new Error("Usage: openstrap create vm <target>");
    }

    if (!kinds.includes(kind as (typeof kinds)[number])) {
      throw new Error(`Unknown kind "${kind}". Known kinds: ${kinds.join(", ")}`);
    }

    if (read.positionals.length > 2) {
      throw new Error("Only one target can be created at a time");
    }

    return {
      command: "create",
      kind: "vm",
      target,
      configPath: read.value("config"),
      hostPort: hostPortIn(read.value("host-port")),
      repin: read.flag("repin"),
      json: read.flag("json"),
      ...runtimeArgsIn(read),
    };
  }
}

function hostPortIn(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("Option --host-port needs a port number");
  }

  return Number(value);
}
