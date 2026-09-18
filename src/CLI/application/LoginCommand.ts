import { hostname } from "node:os";

import { type Code, DeviceLogin, OpenStrapServer, ServerRefusedError } from "../../Api/index.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";
import type { LoginArgs } from "../arguments/types.js";

export type LoginResult = {
  address: string;
  store: string;
  /** Whether a token is now kept, which is the difference between a run going to the server or not. */
  kept: boolean;
  /** The server had no owner, and this computer became it. */
  claimed?: boolean;
};

type SignIn = Pick<typeof OpenStrapServer, "whoSignsIn" | "issueToken" | "claim">;

/**
 * `openstrap login` — the pass this machine shows the server, put where openstrap looks for it.
 *
 * openstrap did not have this, so a token was moved into the secret store by hand with whatever
 * command that store happens to have. Which is a thing to look up, get wrong, and leave in a shell
 * history: the store is a plugin's, and openstrap is the one that knows what it will ask for.
 */
export class LoginCommand implements CliCommand<LoginArgs, LoginResult> {
  constructor(
    private readonly signIn = new DeviceLogin(),
    /** Said while the command waits, so a person has something to act on before it finishes. */
    private readonly show = (code: Code) => process.stderr.write(
      `Open ${code.url} and enter ${code.userCode}. Waiting.\n`,
    ),
    private readonly server: SignIn = OpenStrapServer,
  ) {}

  async execute(args: LoginArgs, context: CommandContext): Promise<CommandOutcome<LoginResult>> {
    const runtime = await context.runtime();
    const store = runtime.secretStores.sole();
    const reference = { ...OpenStrapServer.token, store: store.id };

    if (args.forget) {
      await store.remove(reference);

      return { result: { address: OpenStrapServer.address, store: store.id, kept: false }, exitCode: 0 };
    }

    const who = await this.server.whoSignsIn();

    if (!who) {
      await store.write(reference, await this.claimed());

      return { result: { address: OpenStrapServer.address, store: store.id, kept: true, claimed: true }, exitCode: 0 };
    }

    const { code, waiting } = await this.signIn.begin(who.issuer, who.audience);

    this.show(code);

    // Traded, not kept: what a person signs in with belongs to them and to their provider, and what
    // runs on this machine afterwards should be revocable without touching either.
    await store.write(reference, await this.server.issueToken(await waiting, hostname()));

    return { result: { address: OpenStrapServer.address, store: store.id, kept: true }, exitCode: 0 };
  }

  /** Nobody signs people in there, so the only door is the first one: an empty server belongs to whoever claims it. */
  private async claimed(): Promise<string> {
    try {
      return await this.server.claim(hostname(), hostname());
    } catch (error) {
      if (error instanceof ServerRefusedError && error.status === 409) {
        throw new Error(
          `${OpenStrapServer.address} already has an owner, and nobody signs people in there. `
          + "Ask the owner for a pass: `openstrap tokens issue <name>` on a computer that holds one, "
          + "then `openstrap secret set openstrap.server-token` here.",
        );
      }

      throw error;
    }
  }
}
