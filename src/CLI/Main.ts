import { loadOpenStrapRuntime } from "../Plugin/index.js";
import { CliArgsParser, type ParsedArgs } from "./Arguments/index.js";
import { CliErrors } from "./Errors.js";
import { JsonOutput, TextOutput, type Answer, type CommandOutput } from "./Output/CommandOutput.js";
import { ConnectText } from "./Output/ConnectText.js";
import { CreateText } from "./Output/CreateText.js";
import { FactsText } from "./Output/FactsText.js";
import { RunText } from "./Output/RunText.js";
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
 * The command line: read the arguments, run the command they name, present what came of it.
 *
 * Nothing here decides what a command does or what its outcome means — the command owns
 * both — and nothing here decides how a result reads, which belongs to that command's own
 * words. What is decided here is the shape they share: bad arguments print the usage and
 * exit 2, and a thrown error prints and exits 2.
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
    const answer = await run(args, {
      workspaceRoot: io.cwd,
      runtime: () => loadOpenStrapRuntime({
        cwd: io.cwd,
        configPath: args.runtimeConfigPath,
        specifiers: args.pluginSpecifiers,
      }),
    }, "json" in args && args.json ? new JsonOutput() : new TextOutput());

    io.stdout.write(answer.output);

    return answer.exitCode;
  } catch (error) {
    io.stderr.write(`${errors.format(error)}\n`);

    return 2;
  }
}

/**
 * Which command answers to these arguments, and in whose words.
 *
 * Each branch is one expression: the command, the arguments the compiler has already
 * narrowed to its own type, and the words its own result reads by. A command can neither
 * be given another's arguments nor read out in another's words, and one that is added and
 * not handled will not compile.
 */
async function run(args: ParsedArgs, context: CommandContext, output: CommandOutput): Promise<Answer> {
  switch (args.command) {
    case "run":
      return output.present(await new RunCommand().execute(args, context), new RunText());
    case "create":
      return output.present(await new CreateCommand().execute(args, context), new CreateText());
    case "connect":
      return output.present(await new ConnectCommand().execute(args, context), new ConnectText());
    case "facts.collect":
      return output.present(await new FactsCollectCommand().execute(args, context), new FactsText());
  }
}
