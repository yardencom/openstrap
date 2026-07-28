import { loadOpenStrapRuntime } from "../Plugin/index.js";
import { CliArgsParser, type ParsedArgs } from "./Arguments/index.js";
import { CliErrors } from "./Errors.js";
import { output } from "./Output/index.js";
import type { CommandContext, CommandOutcome } from "./application/CliCommand.js";
import { ConnectCommand } from "./application/ConnectCommand.js";
import { CreateCommand } from "./application/CreateCommand.js";
import { FactsCollectCommand } from "./application/FactsCollectCommand.js";
import { RunCommand } from "./application/RunCommand.js";

export type CliIo = {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
  cwd: string;
};

/**
 * The command line: read the arguments, run the command they name, print what came of it.
 *
 * Nothing here decides what a command does or what its outcome means — the command owns both —
 * and nothing here decides how a result reads, which the output owns. What is decided here is
 * the shape they share: whatever goes wrong prints and exits 2, and the usage follows when what
 * went wrong was the command line itself.
 */
export async function main(argv: readonly string[], io: CliIo = {
  stdout: process.stdout,
  stderr: process.stderr,
  cwd: process.cwd(),
}): Promise<number> {
  try {
    const args = new CliArgsParser().parse(argv);
    const outcome = await run(args, {
      workspaceRoot: io.cwd,
      runtime: () => loadOpenStrapRuntime({
        cwd: io.cwd,
        configPath: args.runtimeConfigPath,
        specifiers: args.pluginSpecifiers,
      }),
    });

    io.stdout.write(output(args).print(args.command, outcome.result));

    return outcome.exitCode;
  } catch (error) {
    io.stderr.write(`${new CliErrors().format(error)}\n`);

    return 2;
  }
}

/**
 * Which command answers to these arguments.
 *
 * Selection and nothing else. Each branch is handed arguments the compiler has already narrowed
 * to that command's own type, so a command can never be given another's, and one that is added
 * and not handled will not compile.
 */
function run(args: ParsedArgs, context: CommandContext): Promise<CommandOutcome<unknown>> {
  switch (args.command) {
    case "run":
      return new RunCommand().execute(args, context);
    case "create":
      return new CreateCommand().execute(args, context);
    case "connect":
      return new ConnectCommand().execute(args, context);
    case "facts.collect":
      return new FactsCollectCommand().execute(args, context);
  }
}
