import type { CommandArgsParser, CreateArgs } from "../types.js";
import { CommandArguments } from "../CommandArguments.js";

/** What openstrap knows how to create. */
const kinds = ["vm"] as const;

export class CreateArgsParser implements CommandArgsParser {
  readonly command = "create";

  parse(args: readonly string[]): CreateArgs {
    const read = new CommandArguments(args, {
      ...CommandArguments.runtimeOptions,
      flags: [...(CommandArguments.runtimeOptions.flags ?? []), "json", "repin"],
      values: [...(CommandArguments.runtimeOptions.values ?? []), "config", "host-port", "os", "provider"],
    });
    const [kind, target] = read.positionals;

    if (kind !== undefined && !kinds.includes(kind as (typeof kinds)[number])) {
      throw new Error(`Unknown kind "${kind}". Known kinds: ${kinds.join(", ")}`);
    }

    if (!kind || !target) {
      throw new Error("Usage: openstrap create vm <target>");
    }

    if (read.positionals.length > 2) {
      throw new Error("Only one target can be created at a time");
    }

    return {
      command: "create",
      kind: "vm",
      target,
      os: read.value("os"),
      provider: read.value("provider"),
      configPath: read.value("config"),
      hostPort: CommandArguments.hostPortIn(read.value("host-port")),
      repin: read.flag("repin"),
      json: read.flag("json"),
      ...CommandArguments.runtimeArgsIn(read),
    };
  }
}
