/** Which options a command accepts, and in which form. */
export type AcceptedOptions = {
  /** Options that are either given or not: `--json`. */
  flags?: readonly string[];
  /** Options that carry one value: `--config path`. The last one given wins. */
  values?: readonly string[];
  /** Options that may be given more than once: `--plugin a --plugin b`. */
  repeated?: readonly string[];
};

/**
 * The arguments of one command, read once and answered by name.
 *
 * Every option may be written either way — `--config path` or `--config=path` — and
 * that was the reason to have this at all: the splitting was written out by hand in
 * every parser that took an option, four times, each with its own error message, and
 * the runtime options had a second idiom of their own that returned an index for the
 * caller to assign back to its loop counter.
 *
 * An option this command did not declare is an error rather than a positional, because
 * a mistyped `--jsno` silently becoming a target name is worse than being told.
 */
export class CommandArguments {
  readonly positionals: string[] = [];
  private readonly given = new Set<string>();
  private readonly valuesByName = new Map<string, string[]>();

  constructor(args: readonly string[], private readonly accepted: AcceptedOptions) {
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index]!;

      if (!arg.startsWith("-")) {
        this.positionals.push(arg);
        continue;
      }

      const separator = arg.indexOf("=");
      const name = (separator === -1 ? arg : arg.slice(0, separator)).replace(/^--?/, "");

      if (this.accepts(name, "flags")) {
        if (separator !== -1) {
          throw new Error(`Option --${name} takes no value`);
        }

        this.given.add(name);
        continue;
      }

      if (!this.accepts(name, "values") && !this.accepts(name, "repeated")) {
        throw new Error(`Unknown option "${arg}"`);
      }

      const value = separator === -1 ? args[++index] : arg.slice(separator + 1);

      if (!value) {
        throw new Error(`Missing value for --${name}`);
      }

      this.valuesByName.set(name, [...(this.valuesByName.get(name) ?? []), value]);
    }
  }

  flag(name: string): boolean {
    return this.given.has(name);
  }

  value(name: string): string | undefined {
    const values = this.valuesByName.get(name);

    return values?.[values.length - 1];
  }

  values(name: string): string[] {
    return [...(this.valuesByName.get(name) ?? [])];
  }

  private accepts(name: string, kind: keyof AcceptedOptions): boolean {
    return (this.accepted[kind] ?? []).includes(name);
  }
}

/**
 * The options every command shares, and what they mean once read.
 *
 * Which plugins a run may reach and where its runtime config lives are not properties
 * of any one command, so no command declares them for itself.
 */
export const runtimeOptions: AcceptedOptions = {
  values: ["runtime-config"],
  repeated: ["plugin"],
};

export function runtimeArgsIn(read: CommandArguments): { runtimeConfigPath?: string; pluginSpecifiers: string[] } {
  return {
    runtimeConfigPath: read.value("runtime-config"),
    pluginSpecifiers: read.values("plugin"),
  };
}

/**
 * A host port as a command line gives one.
 *
 * Shared, because two commands take it: `create` names the port one machine gets, and `run` names
 * where to start looking for free ones.
 */
export function hostPortIn(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("Option --host-port needs a port number");
  }

  return Number(value);
}
