import { OpenStrapServer } from "../../Api/index.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";
import type { KnownToken } from "../../Api/index.js";
import type { TokensArgs } from "../arguments/types.js";
import { WhereMachinesAreRecorded } from "./WhereMachinesAreRecorded.js";

export type TokensResult = {
  did: "list" | "issue" | "revoke";
  known?: readonly KnownToken[];
  /** Shown once, because the server keeps only its hash and cannot be asked again. */
  issued?: { name: string; token: string };
  revoked?: string;
};

/**
 * `openstrap tokens` — the passes an organization has, and taking one away.
 *
 * Issuing is how something that cannot sign in gets one: an agent has no browser, so a person who
 * is already signed in makes a pass for it. Revoking is what makes that safe — before this, a token
 * handed to a laptop was handed over for good.
 */
export class TokensCommand implements CliCommand<TokensArgs, TokensResult> {
  async execute(args: TokensArgs, context: CommandContext): Promise<CommandOutcome<TokensResult>> {
    const runtime = await context.runtime();
    const recorded = await WhereMachinesAreRecorded.of(runtime, args.local);

    try {
      // Every word here is about the organization's record, so there is nowhere to do it locally.
      const server = recorded.server ?? await OpenStrapServer.of(runtime.secretStores.soleIfAny());

      if (args.did === "issue") {
        return { result: { did: "issue", issued: await server.issueFor(args.subject!) }, exitCode: 0 };
      }

      if (args.did === "revoke") {
        await server.revokeToken(args.subject!);

        return { result: { did: "revoke", revoked: args.subject }, exitCode: 0 };
      }

      return { result: { did: "list", known: await server.tokens() }, exitCode: 0 };
    } finally {
      recorded.close();
    }
  }
}
