import { loadOpenStrapRuntime } from "../Plugin/index.js";
import { CliArgsParser, type ParsedArgs } from "./Arguments/index.js";
import { CliErrors } from "./Errors.js";
import { JsonOutput, TextOutput, type CommandOutput } from "./Output/CommandOutput.js";
import type { CliCommand, CommandContext } from "./application/CliCommand.js";
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
 * The command line: read the arguments, run the command they name, present what came of
 * it.
 *
 * Nothing here decides what a command does or what its outcome means — the command owns
 * both — and nothing here decides how a result reads, which is the output's job. What is
 * decided here is the shape they share: bad arguments print the usage and exit 2, and a
 * thrown error prints and exits 2.
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

  const output = "json" in args && args.json ? new JsonOutput() : new TextOutput();
  const context: CommandContext = {
    workspaceRoot: io.cwd,
    runtime: () => loadOpenStrapRuntime({
      cwd: io.cwd,
      configPath: args.runtimeConfigPath,
      specifiers: args.pluginSpecifiers,
    }),
  };

  try {
    const answer = await dispatch(args, context, output);

    io.stdout.write(answer.output);

    return answer.exitCode;
  } catch (error) {
    io.stderr.write(`${errors.format(error)}\n`);

    return 2;
  }
}

/** What a command line answers with: something to print, and how the process should end. */
type Presented = {
  output: string;
  exitCode: number;
};

/**
 * Which command answers to these arguments, and how its result is presented.
 *
 * Selection and nothing else: each branch names a command and the way that command's
 * result reads, and the work of running one and presenting the other happens once, below.
 * Each branch hands its command arguments the compiler has already narrowed to that
 * command's own type, and a presenter that takes that command's own result — so a
 * command can neither be given another's arguments nor presented as another command, and
 * one that is added and not handled will not compile.
 */
function dispatch(
  args: ParsedArgs,
  context: CommandContext,
  output: CommandOutput,
): Promise<Presented> {
  switch (args.command) {
    case "run":
      return presented(new RunCommand(), args, context, (result) => output.run(result));
    case "create":
      return presented(new CreateCommand(), args, context, (result) => output.create(result));
    case "connect":
      return presented(new ConnectCommand(), args, context, (result) => output.connect(result));
    case "facts.collect":
      return presented(new FactsCollectCommand(), args, context, (result) => output.factsCollect(result));
  }
}

/** Run the command, put its result into words, keep its exit code. */
async function presented<TArgs extends ParsedArgs, TResult>(
  command: CliCommand<TArgs, TResult>,
  args: TArgs,
  context: CommandContext,
  render: (result: TResult) => string,
): Promise<Presented> {
  const { result, exitCode } = await command.execute(args, context);

  return { output: render(result), exitCode };
}
