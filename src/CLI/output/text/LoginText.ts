import type { CommandText } from "../types.js";
import type { LoginResult } from "../../application/LoginCommand.js";

export class LoginText implements CommandText<LoginResult> {
  print(result: LoginResult): string {
    return result.kept
      ? `The token for ${result.address} is in ${result.store}. Runs go to the server now.\n`
      : `No token for ${result.address} is kept in ${result.store} any more. Runs stay on this computer.\n`;
  }
}
