import { OpenStrapRuntime } from "../Plugin/index.js";
import { CliUsageError } from "./arguments/index.js";
import { CliErrors } from "./Errors.js";
import { GlobalOptions } from "./arguments/GlobalOptions.js";
import { openstrapCommands } from "./commands/OpenStrapCommands.js";
import type { CommandContext } from "./application/CliCommand.js";

export type CliIo = {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
  cwd: string;
};

/**
 * The command line: find whoever owns the first word, let them read the rest, print what came of it.
 *
 * Which words exist is not written here and cannot be: they are the commands the plugins in force
 * registered, and openstrap's own are registered by a plugin too. So `openstrap workloads run` is a
 * question about the project's configuration, not about this file.
 *
 * Nothing here decides what a command does or what its outcome means — the command owns both — and
 * nothing here decides how a result reads, which the command also owns, because openstrap cannot
 * know how the result of a command it did not write should read. What is decided here is the shape
 * they share: `--json` is answered the same way for all of them, whatever goes wrong prints and
 * exits 2, and the usage follows when what went wrong was the command line itself.
 */
export async function main(argv: readonly string[], io: CliIo = {
  stdout: process.stdout,
  stderr: process.stderr,
  cwd: process.cwd(),
}): Promise<number> {
  const global = new GlobalOptions(argv);
  let usage: readonly string[] = [];

  try {
    const runtime = await OpenStrapRuntime.load({
      cwd: io.cwd,
      plugins: [openstrapCommands()],
      configPath: global.runtimeConfigPath(),
      specifiers: global.pluginSpecifiers(),
    });

    usage = runtime.commands.usage();

    const word = global.command();

    if (!word) {
      throw new CliUsageError("Missing command");
    }

    const command = runtime.commands.require(word);
    const args = read(command, global.rest());
    // The runtime is already in hand: finding out which words exist meant loading the plugins, so
    // a command that needs a provider or a transport is handed the same runtime that named it.
    const context: CommandContext = {
      workspaceRoot: io.cwd,
      runtime: () => Promise.resolve(runtime),
    };
    const outcome = await command.execute(args, context);

    io.stdout.write(global.json()
      ? `${JSON.stringify(outcome.result, null, 2)}\n`
      : command.text(outcome.result));

    return outcome.exitCode;
  } catch (error) {
    io.stderr.write(`${new CliErrors(usage).format(error)}\n`);

    return 2;
  }
}

/**
 * A command reading its own arguments.
 *
 * Everything a command rejects is the command line being wrong, so it all reads the same way to the
 * caller: the complaint, then what is on offer.
 */
function read(command: { parse(args: readonly string[]): unknown }, args: readonly string[]): never {
  try {
    return command.parse(args) as never;
  } catch (error) {
    throw error instanceof CliUsageError
      ? error
      : new CliUsageError(error instanceof Error ? error.message : String(error));
  }
}
