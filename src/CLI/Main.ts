import { loadOpenStrapRuntime } from "../Plugin/index.js";
import { CliArgsParser, type ParsedArgs } from "./Arguments/index.js";
import { CliErrors } from "./Errors.js";
import { ConnectText } from "./Output/ConnectText.js";
import { CreateText } from "./Output/CreateText.js";
import { FactsText } from "./Output/FactsText.js";
import { JsonOutput, TextOutput, type Output } from "./Output/Output.js";
import { RunText } from "./Output/RunText.js";
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
 * Nothing here decides what a command does or what its outcome means — the command owns both
 * — and nothing here decides how a result is read out, which the output owns. What is decided
 * here is the shape they share: whatever goes wrong prints and exits 2, and the usage follows
 * when what went wrong was the command line itself.
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
    }, "json" in args && args.json ? new JsonOutput() : new TextOutput());

    io.stdout.write(outcome.result);

    return outcome.exitCode;
  } catch (error) {
    io.stderr.write(`${new CliErrors().format(error)}\n`);

    return 2;
  }
}

/**
 * Which command answers to these arguments, and in whose words.
 *
 * Each branch names three things: the command, the arguments the compiler has already narrowed
 * to its own type, and the words its result reads by. A command can neither be given another's
 * arguments nor read out in another's words, and one that is added and not handled will not
 * compile.
 *
 * `connect` is always read out in its own words, because it has no `--json` to ask for: what it
 * hands back is the machine's own output, and openstrap reformatting that would be talking over
 * the answer.
 */
async function run(
  args: ParsedArgs,
  context: CommandContext,
  output: Output,
): Promise<CommandOutcome<string>> {
  switch (args.command) {
    case "run":
      return output.read(await new RunCommand().execute(args, context), () => new RunText());
    case "create":
      return output.read(await new CreateCommand().execute(args, context), () => new CreateText());
    case "connect":
      return output.read(await new ConnectCommand().execute(args, context), () => new ConnectText());
    case "facts.collect":
      return output.read(await new FactsCollectCommand().execute(args, context), () => new FactsText());
  }
}
