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
import { ListArgsParser } from "../arguments/parsers/ListArgs.js";
import { TokensArgsParser } from "../arguments/parsers/TokensArgs.js";
import { TokensCommand } from "../application/TokensCommand.js";
import { TokensText } from "../output/text/TokensText.js";
import { LoginArgsParser } from "../arguments/parsers/LoginArgs.js";
import { LoginCommand } from "../application/LoginCommand.js";
import { LoginText } from "../output/text/LoginText.js";
import { ListCommand } from "../application/ListCommand.js";
import { ListText } from "../output/text/ListText.js";
import { FactsCollectCommand } from "../application/FactsCollectCommand.js";
import { FactsText } from "../output/text/FactsText.js";
import { RunArgsParser } from "../arguments/parsers/RunArgs.js";
import { RunCommand } from "../application/RunCommand.js";
import { RunText } from "../output/text/RunText.js";
import type { CommandContext } from "../application/CliCommand.js";

type Parser<TArgs> = { parse(args: readonly string[]): TArgs };
type Work<TArgs, TResult> = {
  execute(args: TArgs, context: CommandContext): Promise<{ result: TResult; exitCode: number }>;
};
type Words<TResult> = { print(result: TResult): string };

export class OpenStrapCommands {
  /** openstrap's own commands, as a plugin. */
  static plugin(): OpenStrapPlugin {
    return {
      name: "openstrap:cli",
      enforce: "pre",
      setup(api) {
        for (const command of OpenStrapCommands.commands()) {
          api.registerCommand(command as OpenStrapCommand);
        }
      },
    };
  }

  private static commands(): readonly OpenStrapCommand[] {
    return [
      OpenStrapCommands.command(
        "run",
        "openstrap run [configPath] [--host-port n] [--json] [--runtime-config path] [--plugin specifier]",
        new RunArgsParser(), new RunCommand(), new RunText(),
      ),
      OpenStrapCommands.command(
        "create",
        "openstrap create vm <name> [--os distribution:version] [--provider id] [--config path] [--host-port n] [--repin] [--json]",
        new CreateArgsParser(), new CreateCommand(), new CreateText(),
      ),
      OpenStrapCommands.command(
        "converge",
        "openstrap converge <host|target> [--check] [--max-passes n] [--json] [--plugin specifier]",
        new ConvergeArgsParser(), new ConvergeCommand(), new ConvergeText(),
      ),
      OpenStrapCommands.command(
        "login",
        "openstrap login [--forget] [--json]",
        new LoginArgsParser(), new LoginCommand(), new LoginText(),
      ),
      OpenStrapCommands.command(
        "tokens",
        "openstrap tokens [issue <name> | revoke <id>] [--json]",
        new TokensArgsParser(), new TokensCommand(), new TokensText(),
      ),
      OpenStrapCommands.command(
        "list",
        "openstrap list [--json] [--plugin specifier]",
        new ListArgsParser(), new ListCommand(), new ListText(),
      ),
      OpenStrapCommands.command(
        "connect",
        "openstrap connect <target> [--run command] [--plugin specifier]",
        new ConnectArgsParser(), new ConnectCommand(), new ConnectText(),
      ),
      OpenStrapCommands.command(
        "facts",
        "openstrap facts collect <host|target> [--json] [--plugin specifier]",
        new FactsArgsParser(), new FactsCollectCommand(), new FactsText(),
      ),
    ];
  }

  /** One of openstrap's commands, assembled from its three parts. */
  private static command<TArgs, TResult>(
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
}
