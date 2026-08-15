import type { RuntimeArgs } from "./types.js";
/** Which options a command accepts, and in which form. */
export type AcceptedOptions = {
  /** Options that are either given or not: `--json`. */
  flags?: readonly string[];
  /** Options that carry one value: `--config path`. The last one given wins. */
  values?: readonly string[];
  /** Options that may be given more than once: `--plugin a --plugin b`. */
  repeated?: readonly string[];
};

/** The arguments of one command, read once and answered by name. */
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
  /** Not properties of any one command, so no command declares them for itself. */
  static readonly runtimeOptions: AcceptedOptions = {
    values: ["runtime-config"],
    repeated: ["plugin"],
    flags: ["local", "server"],
  };

  static runtimeArgsIn(read: CommandArguments): RuntimeArgs {
    return {
      local: read.flag("local"),
      server: read.flag("server"),
      runtimeConfigPath: read.value("runtime-config"),
      pluginSpecifiers: read.values("plugin"),
    };
  }

  /** Shared: `create` names the port one machine gets, `run` where to start looking for free ones. */
  static hostPortIn(value: string | undefined): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (!/^\d+$/.test(value)) {
      throw new Error("Option --host-port needs a port number");
    }

    return Number(value);
  }
}
