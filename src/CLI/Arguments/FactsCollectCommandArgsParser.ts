import type { FactsCollectArgs } from "./CliArgs.js";
import type { FactsSubcommandArgsParser } from "./FactsSubcommandArgsParser.js";
import { RuntimeArgsParser } from "./RuntimeArgsParser.js";

export class FactsCollectCommandArgsParser implements FactsSubcommandArgsParser {
  readonly subcommand = "collect";

  constructor(private readonly runtimeArgs = new RuntimeArgsParser()) {}

  parse(args: readonly string[]): FactsCollectArgs {
    let json = false;
    const positionals: string[] = [];
    const inputs: Record<string, string> = {};
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

      if (arg === "--input") {
        const value = args[index + 1];

        if (!value) {
          throw new Error("Missing value for --input");
        }

        this.readInputOverride(value, inputs);
        index += 1;
        continue;
      }

      if (arg.startsWith("--input=")) {
        this.readInputOverride(arg.slice("--input=".length), inputs);
        continue;
      }

      if (arg.startsWith("-")) {
        throw new Error(`Unknown option "${arg}"`);
      }

      positionals.push(arg);
    }

    if (positionals[0] !== "host") {
      throw new Error("Missing facts target. Use: openstrap facts collect host");
    }

    if (positionals.length > 2) {
      throw new Error("Only one facts definition path can be provided");
    }

    return {
      command: "facts.collect",
      target: "host",
      configPath: positionals[1] ?? "examples/facts/system-inventory.yaml",
      json,
      inputs,
      ...runtimeArgs,
    };
  }

  private readInputOverride(value: string, inputs: Record<string, string>): void {
    const separator = value.indexOf("=");

    if (separator <= 0) {
      throw new Error(`Invalid --input "${value}". Expected key=value`);
    }

    inputs[value.slice(0, separator)] = value.slice(separator + 1);
  }
}
