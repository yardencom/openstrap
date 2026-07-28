import { loadOpenStrapRuntime } from "../Plugin/index.js";
import { CliArgsParser, type ParsedArgs } from "./Arguments/index.js";
import { CommandLine, type Answer } from "./CommandLine.js";
import { CliErrors } from "./Errors.js";
import { JsonOutput, TextOutput } from "./Output/CommandOutput.js";
import { renderCreateOutput } from "./Output/CreateOutput.js";
import { renderFactsOutput } from "./Output/FactsOutput.js";
import { renderRunOutput } from "./Output/RunOutput.js";
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
 * The command line: read the arguments, run the command they name, present what came of it.
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

  const line = new CommandLine({
    workspaceRoot: io.cwd,
    runtime: () => loadOpenStrapRuntime({
      cwd: io.cwd,
      configPath: args.runtimeConfigPath,
      specifiers: args.pluginSpecifiers,
    }),
  }, "json" in args && args.json ? new JsonOutput() : new TextOutput());

  try {
    const answer = await dispatch(args, line);

    io.stdout.write(answer.output);

    return answer.exitCode;
  } catch (error) {
    io.stderr.write(`${errors.format(error)}\n`);

    return 2;
  }
}

/**
 * Which command answers to these arguments, and how its result reads.
 *
 * Selection and nothing else. Each branch is handed arguments the compiler has already
 * narrowed to that command's own type and a rendering that takes that command's own
 * result, so a command can neither be given another's arguments nor presented as another
 * command, and one that is added and not handled will not compile.
 */
function dispatch(args: ParsedArgs, line: CommandLine): Promise<Answer> {
  switch (args.command) {
    case "run":
      return line.answer(new RunCommand(), args, renderRunOutput);
    case "create":
      return line.answer(new CreateCommand(), args, renderCreateOutput);
    case "connect":
      // What the machine said, unchanged: openstrap adding anything around it would be
      // talking over the answer.
      return line.answer(new ConnectCommand(), args, (result) => result.output);
    case "facts.collect":
      return line.answer(new FactsCollectCommand(), args, renderFactsOutput);
  }
}
