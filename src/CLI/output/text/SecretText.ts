import type { CommandText } from "../types.js";
import type { SecretResult } from "../../application/SecretCommand.js";

export class SecretText implements CommandText<SecretResult> {
  print(result: SecretResult): string {
    return result.kept
      ? `"${result.name}" is kept in ${result.store}. Blueprints may name it now.\n`
      : `"${result.name}" is no longer kept in ${result.store}.\n`;
  }
}
