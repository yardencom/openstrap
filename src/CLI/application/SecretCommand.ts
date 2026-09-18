import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";
import type { SecretArgs } from "../arguments/types.js";

export type SecretResult = {
  name: string;
  store: string;
  kept: boolean;
};

const interrupt = String.fromCharCode(3);
const erase = [String.fromCharCode(127), "\b"];

/** `secret` — put a value into the store the blueprint's names point at, or take one out. */
export class SecretCommand implements CliCommand<SecretArgs, SecretResult> {
  constructor(private readonly read: (name: string) => Promise<string> = SecretCommand.fromStdin) {}

  async execute(args: SecretArgs, context: CommandContext): Promise<CommandOutcome<SecretResult>> {
    const store = (await context.runtime()).secretStores.sole();
    const reference = { store: store.id, name: args.name };

    if (args.did === "forget") {
      await store.remove(reference);

      return { result: { name: args.name, store: store.id, kept: false }, exitCode: 0 };
    }

    const value = (await this.read(args.name)).replace(/\r?\n$/, "");

    if (value.length === 0) {
      throw new Error(`no value was given for "${args.name}"`);
    }

    await store.write(reference, value);

    return { result: { name: args.name, store: store.id, kept: true }, exitCode: 0 };
  }

  /** Typed without echo at a terminal; read whole when piped in. Never an argument, so never in a shell history. */
  private static fromStdin(name: string): Promise<string> {
    return process.stdin.isTTY ? SecretCommand.typed(`Value for "${name}": `) : SecretCommand.piped();
  }

  private static async piped(): Promise<string> {
    let value = "";
    process.stdin.setEncoding("utf8");

    for await (const chunk of process.stdin) {
      value += chunk;
    }

    return value;
  }

  private static typed(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const input = process.stdin;
      let value = "";
      const stop = () => {
        input.setRawMode(false);
        input.pause();
        input.off("data", onData);
      };
      const onData = (chunk: string) => {
        for (const char of chunk) {
          if (char === "\r" || char === "\n") {
            stop();
            process.stderr.write("\n");
            resolve(value);
            return;
          }

          if (char === interrupt) {
            stop();
            reject(new Error("interrupted"));
            return;
          }

          value = erase.includes(char) ? value.slice(0, -1) : value + char;
        }
      };

      process.stderr.write(prompt);
      input.setEncoding("utf8");
      input.setRawMode(true);
      input.resume();
      input.on("data", onData);
    });
  }
}
