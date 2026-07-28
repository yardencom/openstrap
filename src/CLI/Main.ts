import { loadOpenStrapRuntime } from "../Plugin/index.js";
import { CliArgsParser, type ParsedArgs } from "./Arguments/index.js";
import { CliErrors } from "./Errors.js";
import { JsonOutput, TextOutput } from "./Output/CommandOutput.js";
import type { CommandContext } from "./application/CliCommand.js";
import { ConnectCommand } from "./application/ConnectCommand.js";
import { CreateCommand } from "./application/CreateCommand.js";
import { FactsCollectCommand } from "./application/FactsCollectCommand.js";
import type { NamedOutcome } from "./application/NamedOutcome.js";
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

  const output = "json" in args && args.json ? new JsonOutput() : new TextOutput();

  try {
    const outcome = await run(args, {
      workspaceRoot: io.cwd,
      runtime: () => loadOpenStrapRuntime({
        cwd: io.cwd,
        configPath: args.runtimeConfigPath,
        specifiers: args.pluginSpecifiers,
      }),
    });

    io.stdout.write(output.present(outcome));

    return outcome.exitCode;
  } catch (error) {
    io.stderr.write(`${errors.format(error)}\n`);

    return 2;
  }
}

/**
 * Which command answers to these arguments.
 *
 * Selection, and naming what came back. Each branch is handed arguments the compiler has
 * already narrowed to that command's own type, so a command can never be given another's,
 * and one that is added and not handled will not compile.
 */
async function run(args: ParsedArgs, context: CommandContext): Promise<NamedOutcome> {
  switch (args.command) {
    case "run":
      return { command: args.command, ...await new RunCommand().execute(args, context) };
    case "create":
      return { command: args.command, ...await new CreateCommand().execute(args, context) };
    case "connect":
      return { command: args.command, ...await new ConnectCommand().execute(args, context) };
    case "facts.collect":
      return { command: args.command, ...await new FactsCollectCommand().execute(args, context) };
  }
}
