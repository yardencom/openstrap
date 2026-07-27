import type { CreateArgs } from "./CliArgs.js";
import type { CliCommandArgsParser } from "./CliCommandArgsParser.js";
import { RuntimeArgsParser } from "./RuntimeArgsParser.js";

const kinds = ["vm"] as const;

export class CreateCommandArgsParser implements CliCommandArgsParser {
  readonly command = "create";

  constructor(private readonly runtimeArgs = new RuntimeArgsParser()) {}

  parse(args: readonly string[]): CreateArgs {
    let json = false;
    let configPath: string | undefined;
    let hostPort: number | undefined;
    const positional: string[] = [];
    const runtimeArgs = this.runtimeArgs.create();

    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index]!;
      const runtimeOptionIndex = this.runtimeArgs.readOption(arg, args, index, runtimeArgs);

      if (runtimeOptionIndex !== undefined) {
        index = runtimeOptionIndex;
        continue;
      }

      if (arg === "--json") {
        json = true;
        continue;
      }

      if (arg === "--config" || arg.startsWith("--config=")) {
        const value = arg.includes("=") ? arg.slice("--config=".length) : args[++index];

        if (!value) {
          throw new Error("Option --config needs a path");
        }

        configPath = value;
        continue;
      }

      if (arg === "--host-port" || arg.startsWith("--host-port=")) {
        const value = arg.includes("=") ? arg.slice("--host-port=".length) : args[++index];

        if (!value || !/^\d+$/.test(value)) {
          throw new Error("Option --host-port needs a port number");
        }

        hostPort = Number(value);
        continue;
      }

      if (arg.startsWith("-")) {
        throw new Error(`Unknown option "${arg}"`);
      }

      positional.push(arg);
    }

    const [kind, name] = positional;

    if (!kind || !name) {
      throw new Error("Usage: openstrap create vm <target>");
    }

    if (!kinds.includes(kind as (typeof kinds)[number])) {
      throw new Error(`Unknown kind "${kind}". Known kinds: ${kinds.join(", ")}`);
    }

    if (positional.length > 2) {
      throw new Error("Only one target can be created at a time");
    }

    return {
      command: "create",
      kind: "vm",
      target: name,
      configPath,
      hostPort,
      json,
      ...runtimeArgs,
    };
  }
}
