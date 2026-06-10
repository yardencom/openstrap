import type { RunArgs } from "./CliArgs.js";
import type { CliCommandArgsParser } from "./CliCommandArgsParser.js";
import { RuntimeArgsParser } from "./RuntimeArgsParser.js";

export class RunCommandArgsParser implements CliCommandArgsParser {
  readonly command = "run";

  constructor(private readonly runtimeArgs = new RuntimeArgsParser()) {}

  parse(args: readonly string[]): RunArgs {
    let json = false;
    let configPath: string | undefined;
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

      if (arg.startsWith("-")) {
        throw new Error(`Unknown option "${arg}"`);
      }

      if (configPath) {
        throw new Error("Only one config path can be provided");
      }

      configPath = arg;
    }

    return {
      command: "run",
      configPath,
      json,
      ...runtimeArgs,
    };
  }
}
