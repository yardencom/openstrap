import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { ConnectToTarget } from "../../Connect/index.js";
import type { OpenStrapRuntime } from "../../Plugin/index.js";
import { SqliteStateStore } from "../../StateStore/index.js";
import { stateHome } from "./CreateCommand.js";

export type ConnectCommandRequest = {
  target: string;
  command?: string;
  runtime: OpenStrapRuntime;
};

export type ConnectCommandResult = {
  output: string;
  exitCode: number;
};

export async function connectToTarget(request: ConnectCommandRequest): Promise<ConnectCommandResult> {
  const home = stateHome();
  mkdirSync(home, { recursive: true });

  const store = new SqliteStateStore(join(home, "state.db"));

  try {
    const connection = await new ConnectToTarget().execute({
      target: request.target,
      runtime: request.runtime,
      store,
    });

    try {
      if (!request.command) {
        const endpoint = connection.access.endpoint;

        return {
          output: [
            `Connected to ${request.target} over ${connection.access.transport}.`,
            `  ${endpoint.user}@${endpoint.host}:${endpoint.port}`,
            "",
            "Run a command with: openstrap connect " + request.target + " --run '<command>'",
            "",
          ].join("\n"),
          exitCode: 0,
        };
      }

      const result = await connection.run(request.command);

      return {
        output: `${result.stdout}${result.stderr}`,
        exitCode: result.exitCode ?? 1,
      };
    } finally {
      await connection.close();
    }
  } finally {
    store.close();
  }
}
