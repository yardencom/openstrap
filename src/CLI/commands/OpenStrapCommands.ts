import type { OpenStrapCommand, OpenStrapPlugin } from "../../Plugin/index.js";
import { ConnectArgsParser } from "../arguments/parsers/ConnectArgs.js";
import { ConnectCommand } from "../application/ConnectCommand.js";
import { ConnectText } from "../output/text/ConnectText.js";
import { ConvergeArgsParser } from "../arguments/parsers/ConvergeArgs.js";
import { ConvergeCommand } from "../application/ConvergeCommand.js";
import { ConvergeText } from "../output/text/ConvergeText.js";
import { CreateArgsParser } from "../arguments/parsers/CreateArgs.js";
import { CreateCommand } from "../application/CreateCommand.js";
import { CreateText } from "../output/text/CreateText.js";
import { FactsArgsParser } from "../arguments/FactsArgsParser.js";
import { FactsCollectCommand } from "../application/FactsCollectCommand.js";
import { FactsText } from "../output/text/FactsText.js";
import { RunArgsParser } from "../arguments/parsers/RunArgs.js";
import { RunCommand } from "../application/RunCommand.js";
import { RunText } from "../output/text/RunText.js";
import type { CommandContext } from "../application/CliCommand.js";

/**
 * openstrap's own commands, as a plugin.
 *
 * They go through `registerCommand` like anyone else's, so the road a plugin's command travels is
 * the road openstrap drives every day. The alternative — a `switch` for its own words and a registry
 * for the rest — is two mechanisms, and the one openstrap does not use is the one that breaks.
 *
 * Each command is three things it already had, said in one place: the parser that reads its
 * arguments, the class that does the work, and the words its result reads in.
 */
export function openstrapCommands(): OpenStrapPlugin {
  return {
    name: "openstrap:cli",
    enforce: "pre",
    setup(api) {
      for (const command of commands()) {
        api.registerCommand(command as OpenStrapCommand);
      }
    },
  };
}

function commands(): readonly OpenStrapCommand[] {
  return [
    command(
      "run",
      "openstrap run [configPath] [--host-port n] [--json] [--runtime-config path] [--plugin specifier]",
      new RunArgsParser(), new RunCommand(), new RunText(),
    ),
    command(
      "create",
      "openstrap create vm <target> [--config path] [--host-port n] [--repin] [--json] [--plugin specifier]",
      new CreateArgsParser(), new CreateCommand(), new CreateText(),
    ),
    command(
      "converge",
      "openstrap converge <host|target> [--check] [--max-passes n] [--json] [--plugin specifier]",
      new ConvergeArgsParser(), new ConvergeCommand(), new ConvergeText(),
    ),
    command(
      "connect",
      "openstrap connect <target> [--run command] [--plugin specifier]",
      new ConnectArgsParser(), new ConnectCommand(), new ConnectText(),
    ),
    command(
      "facts",
      "openstrap facts collect <host|target> [--json] [--plugin specifier]",
      new FactsArgsParser(), new FactsCollectCommand(), new FactsText(),
    ),
  ];
}

type Parser<TArgs> = { parse(args: readonly string[]): TArgs };
type Work<TArgs, TResult> = {
  execute(args: TArgs, context: CommandContext): Promise<{ result: TResult; exitCode: number }>;
};
type Words<TResult> = { print(result: TResult): string };

/**
 * One of openstrap's commands, assembled from the three parts it is made of.
 *
 * The context is openstrap's own, which is wider than the contract's: its commands reach for the
 * runtime, and a plugin's command is handed only where it was run and when. Widening what a plugin
 * gets is a decision about the boundary, and it has not been made yet.
 */
function command<TArgs, TResult>(
  name: string,
  usage: string,
  parser: Parser<TArgs>,
  work: Work<TArgs, TResult>,
  words: Words<TResult>,
): OpenStrapCommand<TArgs, TResult> {
  return {
    name,
    usage,
    parse: (args) => parser.parse(args),
    execute: (args, context) => work.execute(args, context as CommandContext),
    text: (result) => words.print(result),
  };
}
