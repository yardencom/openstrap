import { hostname } from "node:os";

import { OpenStrapServer } from "../../Api/index.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";
import type { LoginArgs } from "../arguments/types.js";

export type LoginResult = {
  address: string;
  store: string;
  /** Whether a token is now kept, which is the difference between a run going to the server or not. */
  kept: boolean;
};

/**
 * `openstrap login` — the pass this machine shows the server, put where openstrap looks for it.
 *
 * openstrap did not have this, so a token was moved into the secret store by hand with whatever
 * command that store happens to have. Which is a thing to look up, get wrong, and leave in a shell
 * history: the store is a plugin's, and openstrap is the one that knows what it will ask for.
 */
export class LoginCommand implements CliCommand<LoginArgs, LoginResult> {
  constructor(private readonly read = LoginCommand.piped) {}

  async execute(args: LoginArgs, context: CommandContext): Promise<CommandOutcome<LoginResult>> {
    const runtime = await context.runtime();
    const store = runtime.secretStores.sole();
    const reference = { ...OpenStrapServer.token, store: store.id };

    if (args.forget) {
      await store.remove(reference);

      return { result: { address: OpenStrapServer.address, store: store.id, kept: false }, exitCode: 0 };
    }

    const credential = (await this.read()).trim();

    if (!credential) {
      throw new Error(
        "Nothing was piped in. openstrap trades the token your identity provider gave you for one "
        + "of this server's: openstrap login < credential-file",
      );
    }

    // Traded, not kept: what a person signs in with belongs to them and to their provider, and what
    // runs on this machine afterwards should be revocable without touching either.
    await store.write(reference, await OpenStrapServer.issueToken(credential, hostname()));

    return { result: { address: OpenStrapServer.address, store: store.id, kept: true }, exitCode: 0 };
  }

  /** What was piped in. A token typed as an argument is a token in the shell's history. */
  private static async piped(): Promise<string> {
    const chunks: Buffer[] = [];

    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }

    return Buffer.concat(chunks).toString("utf8");
  }
}
