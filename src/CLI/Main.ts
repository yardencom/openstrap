import { loadOpenStrapRuntime } from "../Plugin/index.js";
import { CliArgsParser, type ParsedArgs } from "./Arguments/index.js";
import { CliErrors } from "./Errors.js";
import { JsonOutput, TextOutput, type CommandOutput } from "./Output/CommandOutput.js";
import type { CommandContext } from "./application/CliCommand.js";
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

  try {
    const presented = await run(args, {
      workspaceRoot: io.cwd,
      runtime: () => loadOpenStrapRuntime({
        cwd: io.cwd,
        configPath: args.runtimeConfigPath,
        specifiers: args.pluginSpecifiers,
      }),
    }, outputFor(args));

    io.stdout.write(presented.output);

    return presented.exitCode;
  } catch (error) {
    io.stderr.write(`${errors.format(error)}\n`);

    return 2;
  }
}

/**
 * Which command answers to these arguments, and its result put into words.
 *
 * Each branch hands its command arguments the compiler has already narrowed to that
 * command's own type, and hands the result to the method of the output that takes that
 * type — so a command can neither be given another's arguments nor presented as another
 * command. One that is added and not handled will not compile.
 */
async function run(
  args: ParsedArgs,
  context: CommandContext,
  output: CommandOutput,
): Promise<{ output: string; exitCode: number }> {
  switch (args.command) {
    case "run": {
      const { result, exitCode } = await new RunCommand().execute(args, context);

      return { output: output.run(result), exitCode };
    }

    case "create": {
      const { result, exitCode } = await new CreateCommand().execute(args, context);

      return { output: output.create(result), exitCode };
    }

    case "connect": {
      const { result, exitCode } = await new ConnectCommand().execute(args, context);

      return { output: output.connect(result), exitCode };
    }

    case "facts.collect": {
      const { result, exitCode } = await new FactsCollectCommand().execute(args, context);

      return { output: output.factsCollect(result), exitCode };
    }
  }
}

/**
 * How the caller asked to be answered.
 *
 * Chosen once, from the arguments, and handed to whichever command runs. `connect` has
 * no `--json`, because what it hands back is the machine's own output and openstrap has
 * no business reformatting that.
 */
function outputFor(args: ParsedArgs): CommandOutput {
  return "json" in args && args.json ? new JsonOutput() : new TextOutput();
}
