import { ConnectToTarget, type Connection } from "../../Connect/index.js";
import { SqliteStateStore, StateHome } from "../../StateStore/index.js";
import type { ConnectArgs } from "../Arguments/types.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";

/**
 * `openstrap connect` — reach a machine openstrap created, and optionally run something.
 *
 * The only command whose output is not openstrap's own: with `--run` it hands back what
 * the machine printed, unchanged and undecorated, and exits with the code the machine
 * exited with. Anything added around that would be openstrap talking over the answer.
 */
export class ConnectCommand implements CliCommand<ConnectArgs> {
  constructor(private readonly stateHome = new StateHome()) {}

  async execute(args: ConnectArgs, context: CommandContext): Promise<CommandOutcome> {
    const runtime = await context.runtime();
    const store = new SqliteStateStore(this.stateHome.database());

    try {
      const connection = await new ConnectToTarget().execute({
        target: args.target,
        runtime,
        store,
      });

      try {
        return args.run === undefined
          ? this.reached(args.target, connection.access)
          : await this.ran(connection, args.run);
      } finally {
        await connection.close();
      }
    } finally {
      store.close();
    }
  }

  private reached(target: string, access: Connection["access"]): CommandOutcome {
    return {
      output: [
        `Connected to ${target} over ${access.transport}.`,
        `  ${access.endpoint.user}@${access.endpoint.host}:${access.endpoint.port}`,
        "",
        `Run a command with: openstrap connect ${target} --run '<command>'`,
        "",
      ].join("\n"),
      exitCode: 0,
    };
  }

  private async ran(connection: Connection, command: string): Promise<CommandOutcome> {
    const result = await connection.run(command);

    return {
      output: `${result.stdout}${result.stderr}`,
      exitCode: result.exitCode ?? 1,
    };
  }
}
