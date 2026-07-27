import type { ConnectArgs } from "./CliArgs.js";
import type { CliCommandArgsParser } from "./CliCommandArgsParser.js";
import { RuntimeArgsParser } from "./RuntimeArgsParser.js";

export class ConnectCommandArgsParser implements CliCommandArgsParser {
  readonly command = "connect";

  constructor(private readonly runtimeArgs = new RuntimeArgsParser()) {}

  parse(args: readonly string[]): ConnectArgs {
    let target: string | undefined;
    let run: string | undefined;
    const runtimeArgs = this.runtimeArgs.create();

    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index]!;
      const runtimeOptionIndex = this.runtimeArgs.readOption(arg, args, index, runtimeArgs);

      if (runtimeOptionIndex !== undefined) {
        index = runtimeOptionIndex;
        continue;
      }

      if (arg === "--run" || arg.startsWith("--run=")) {
        const value = arg.includes("=") ? arg.slice("--run=".length) : args[++index];

        if (!value) {
          throw new Error("Option --run needs a command");
        }

        run = value;
        continue;
      }

      if (arg.startsWith("-")) {
        throw new Error(`Unknown option "${arg}"`);
      }

      if (target) {
        throw new Error("Only one target can be connected to at a time");
      }

      target = arg;
    }

    if (!target) {
      throw new Error("Usage: openstrap connect <target>");
    }

    return { command: "connect", target, run, ...runtimeArgs };
  }
}
