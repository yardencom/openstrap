import { CliArgsParser, type ParsedArgs } from "./Arguments/index.js";
import { createCliRuntime } from "./CliRuntime.js";
import { CliErrors } from "./Errors.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./application/CliCommand.js";
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
 * The command line: read the arguments, run the command they name, report.
 *
 * Nothing here decides what a command does, how its result reads, or what its outcome
 * means — each command owns all three. What is decided here is the shape they share:
 * bad arguments print the usage and exit 2, and a thrown error prints and exits 2.
 *
 * The switch is over the discriminated command, so it both picks the command and
 * narrows the arguments handed to it, and a command that is added and not handled is a
 * compile error. It used to fall through to `run`.
 */
export async function main(argv: readonly string[], io: CliIo = {
  stdout: process.stdout,
  stderr: process.stderr,
  cwd: process.cwd(),
}): Promise<number> {
  const errors = new CliErrors();
  let args: ParsedArgs;

  try {
    args = new CliArgsParser().parse(argv);
  } catch (error) {
    io.stderr.write(`${errors.format(error)}\n\n${errors.usage()}\n`);

    return 2;
  }

  try {
    const outcome = await run(args, {
      workspaceRoot: io.cwd,
      runtime: () => createCliRuntime(args, io.cwd),
    });

    io.stdout.write(outcome.output);

    return outcome.exitCode;
  } catch (error) {
    io.stderr.write(`${errors.format(error)}\n`);

    return 2;
  }
}

/**
 * Which command answers to these arguments.
 *
 * Each branch names its command and hands it arguments the compiler has already
 * narrowed to that command's own type, so a command can never be given another's.
 */
function run(args: ParsedArgs, context: CommandContext): Promise<CommandOutcome> {
  switch (args.command) {
    case "run":
      return execute(new RunCommand(), args, context);
    case "create":
      return execute(new CreateCommand(), args, context);
    case "connect":
      return execute(new ConnectCommand(), args, context);
    case "facts.collect":
      return execute(new FactsCollectCommand(), args, context);
  }
}

function execute<TArgs extends ParsedArgs>(
  command: CliCommand<TArgs>,
  args: TArgs,
  context: CommandContext,
): Promise<CommandOutcome> {
  return command.execute(args, context);
}
