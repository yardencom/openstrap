import { Connect, type Connection } from "#features/Connect/Connect.js";
import { WhereMachinesAreRecorded } from "./WhereMachinesAreRecorded.js";
import type { ConnectArgs } from "../arguments/types.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";

/** `openstrap connect` — reach a machine openstrap created, and optionally run something. */
/** What reaching a machine produced: what it said, and how it ended. */
export type ConnectResult = {
  output: string;
  exitCode: number;
};

export class ConnectCommand implements CliCommand<ConnectArgs, ConnectResult> {
  async execute(args: ConnectArgs, context: CommandContext): Promise<CommandOutcome<ConnectResult>> {
    const runtime = await context.runtime();
    const recorded = new WhereMachinesAreRecorded();

    // Anything this machine did while no server was listening goes first: a run that never
    // left is a machine the team cannot see, and a server is now there to be told.
    await recorded.carry(await context.runtime(), context.now);

    try {
      const connection = await new Connect().execute({
        target: args.target,
        runtime,
        store: recorded.store,
        server: recorded.server,
      });

      try {
        return args.run === undefined
          ? this.reached(args.target, connection.access)
          : await this.ran(connection, args.run);
      } finally {
        await connection.close();
      }
    } finally {
      recorded.close();
    }
  }

  private reached(target: string, access: Connection["access"]): CommandOutcome<ConnectResult> {
    return {
      result: {
        output: [
        `Connected to ${target} over ${access.transport}.`,
        `  ${access.endpoint.user}@${access.endpoint.host}:${access.endpoint.port}`,
        "",
          `Run a command with: openstrap connect ${target} --run '<command>'`,
          "",
        ].join("\n"),
        exitCode: 0,
      },
      exitCode: 0,
    };
  }

  private async ran(connection: Connection, command: string): Promise<CommandOutcome<ConnectResult>> {
    // Through a shell, because what a person types after `--run` is a command line and not a program
    // with arguments: `ls -la | head` is one thing to them and three to anything else.
    const result = await connection.transport.processes.capture({
      command: "sh",
      args: ["-c", command],
      cwd: ".",
    });
    const exitCode = result.exitCode ?? 1;

    return {
      result: { output: `${result.stdout}${result.stderr}`, exitCode },
      exitCode,
    };
  }
}
