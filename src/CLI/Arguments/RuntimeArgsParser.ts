import type { RuntimeArgs } from "./CliArgs.js";

export class RuntimeArgsParser {
  create(): RuntimeArgs {
    return {
      pluginSpecifiers: [],
    };
  }

  readOption(
    arg: string,
    args: readonly string[],
    index: number,
    runtimeArgs: RuntimeArgs,
  ): number | undefined {
    if (arg === "--runtime-config") {
      runtimeArgs.runtimeConfigPath = this.readRequiredOptionValue(arg, args[index + 1]);
      return index + 1;
    }

    if (arg.startsWith("--runtime-config=")) {
      runtimeArgs.runtimeConfigPath = this.readInlineOptionValue("--runtime-config", arg);
      return index;
    }

    if (arg === "--plugin") {
      runtimeArgs.pluginSpecifiers.push(this.readRequiredOptionValue(arg, args[index + 1]));
      return index + 1;
    }

    if (arg.startsWith("--plugin=")) {
      runtimeArgs.pluginSpecifiers.push(this.readInlineOptionValue("--plugin", arg));
      return index;
    }

    return undefined;
  }

  private readRequiredOptionValue(option: string, value: string | undefined): string {
    if (!value) {
      throw new Error(`Missing value for ${option}`);
    }

    return value;
  }

  private readInlineOptionValue(option: string, arg: string): string {
    const value = arg.slice(`${option}=`.length);

    if (!value) {
      throw new Error(`Missing value for ${option}`);
    }

    return value;
  }
}
