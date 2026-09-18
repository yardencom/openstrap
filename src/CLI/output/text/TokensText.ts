import type { CommandText } from "../types.js";
import type { TokensResult } from "../../application/TokensCommand.js";

export class TokensText implements CommandText<TokensResult> {
  print(result: TokensResult): string {
    if (result.issued) {
      return `${result.issued.name}\n\n${result.issued.token}\n\n`
        + "Written down now or not at all: the server keeps only its hash and cannot be asked again.\n";
    }

    if (result.revoked) {
      return `${result.revoked} no longer works.\n`;
    }

    const known = result.known ?? [];

    if (known.length === 0) {
      return "This organization has no tokens.\n";
    }

    return `${known.map((token) => [
      token.name.padEnd(20),
      token.id.padEnd(38),
      token.revokedAt ? "revoked" : token.expiresAt ? `until ${token.expiresAt.slice(0, 10)}` : "no expiry",
    ].join(" ")).join("\n")}\n`;
  }
}
