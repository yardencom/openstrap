import { hostname } from "node:os";

import { type Code, DeviceLogin, OpenStrapServer } from "../../Api/index.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";
import type { LoginArgs } from "../arguments/types.js";

export type LoginResult = {
  address: string;
  store: string;
  /** Whether a token is now kept, which is the difference between a run going to the server or not. */
  kept: boolean;
  /** Handed one made for it, rather than shown a code: an agent has nobody to type it. */
  handed?: boolean;
};

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
    /** What was piped in, where anything was: an agent is handed a pass rather than shown a code. */
    private readonly piped = LoginCommand.stdin,
    /** Said while the command waits, so a person has something to act on before it finishes. */
    private readonly show = (code: Code) => process.stderr.write(
      `Open ${code.url} and enter ${code.userCode}. Waiting.\n`,
    ),
  ) {}

  async execute(args: LoginArgs, context: CommandContext): Promise<CommandOutcome<LoginResult>> {
    const runtime = await context.runtime();
    const store = runtime.secretStores.sole();
    const reference = { ...OpenStrapServer.token, store: store.id };

    if (args.forget) {
      await store.remove(reference);

      return { result: { address: OpenStrapServer.address, store: store.id, kept: false }, exitCode: 0 };
    }

    // An agent has no browser and no person at the keyboard, so it is not shown a code: somebody
    // already signed in made it a pass with `openstrap tokens issue` and it arrives here. Piped
    // rather than given as an argument, which would leave it in a shell's history.
    const handed = (await this.piped()).trim();

    if (handed) {
      await store.write(reference, handed);

      return { result: { address: OpenStrapServer.address, store: store.id, kept: true, handed: true }, exitCode: 0 };
    }

    const who = await OpenStrapServer.whoSignsIn();

    if (!who) {
      throw new Error(
        `Nobody signs people in at ${OpenStrapServer.address}: it believes machine tokens only, and `
        + "one of those is made on the server itself.",
      );
    }

    const { code, waiting } = await this.signIn.begin(who.issuer, who.audience);

    this.show(code);

    // Traded, not kept: what a person signs in with belongs to them and to their provider, and what
    // runs on this machine afterwards should be revocable without touching either.
    await store.write(reference, await OpenStrapServer.issueToken(await waiting, hostname()));

    return { result: { address: OpenStrapServer.address, store: store.id, kept: true }, exitCode: 0 };
  }

  /**
   * What was piped in, or nothing where nothing was.
   *
   * A terminal with a person in front of it is not piped into, and waiting on it would hang before
   * the code was ever shown.
   */
  private static async stdin(): Promise<string> {
    if (process.stdin.isTTY) {
      return "";
    }

    const chunks: Buffer[] = [];

    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }

    return Buffer.concat(chunks).toString("utf8");
  }
}
