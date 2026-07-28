import { loadOpenStrapRuntime } from "../Plugin/index.js";
import { CliArgsParser, type ParsedArgs } from "./Arguments/index.js";
import { CliErrors } from "./Errors.js";
import type { CommandText } from "./Output/CommandText.js";
import { ConnectText } from "./Output/ConnectText.js";
import { CreateText } from "./Output/CreateText.js";
import { FactsText } from "./Output/FactsText.js";
import { JsonText } from "./Output/JsonText.js";
import { RunText } from "./Output/RunText.js";
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
 * The command line: read the arguments, run the command they name, print what came of it.
 *
 * Nothing here decides what a command does or what its outcome means — the command owns
 * both — and nothing here decides how a result reads, which belongs to the words it is read
 * by. What is decided here is the shape they share: bad arguments print the usage and exit
 * 2, and a thrown error prints and exits 2.
 */
export async function main(argv: readonly string[], io: CliIo = {
  stdout: process.stdout,
  stderr: process.stderr,
  cwd: process.cwd(),
}): Promise<number> {
  try {
    const args = new CliArgsParser().parse(argv);
    const answer = await run(args, {
      workspaceRoot: io.cwd,
      runtime: () => loadOpenStrapRuntime({
        cwd: io.cwd,
        configPath: args.runtimeConfigPath,
        specifiers: args.pluginSpecifiers,
      }),
    });

    io.stdout.write(answer.result);

    return answer.exitCode;
  } catch (error) {
    io.stderr.write(`${new CliErrors().format(error)}\n`);

    return 2;
  }
}

/**
 * Which command answers to these arguments, and in whose words.
 *
 * Each branch names three things: the command, the arguments the compiler has already
 * narrowed to its own type, and the words its result reads by — exactly one of which is
 * built, the one that is going to be used. `connect` has no `--json` to offer, because what
 * it hands back is the machine's own output and openstrap has no business reformatting that.
 *
 * A command can neither be given another's arguments nor read out in another's words, and
 * one that is added and not handled will not compile.
 */
function run(args: ParsedArgs, context: CommandContext): Promise<CommandOutcome<string>> {
  switch (args.command) {
    case "run":
      return answered(new RunCommand(), args, context, args.json ? new JsonText() : new RunText());
    case "create":
      return answered(new CreateCommand(), args, context, args.json ? new JsonText() : new CreateText());
    case "connect":
      return answered(new ConnectCommand(), args, context, new ConnectText());
    case "facts.collect":
      return answered(new FactsCollectCommand(), args, context, args.json ? new JsonText() : new FactsText());
  }
}

/**
 * Runs the command and reads its result out, keeping the exit code the command decided.
 *
 * The exit code passes through untouched: what a result means is the command's judgement,
 * and the words it is read by have nothing to say about it.
 */
async function answered<TArgs extends ParsedArgs, TResult>(
  command: CliCommand<TArgs, TResult>,
  args: TArgs,
  context: CommandContext,
  text: CommandText<TResult>,
): Promise<CommandOutcome<string>> {
  const { result, exitCode } = await command.execute(args, context);

  return { result: text.describe(result), exitCode };
}
