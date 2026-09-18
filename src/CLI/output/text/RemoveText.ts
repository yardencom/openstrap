import type { CommandText } from "../types.js";
import type { RemoveResult } from "../../application/RemoveCommand.js";

export class RemoveText implements CommandText<RemoveResult> {
  print(result: RemoveResult): string {
    const machine = result.machine === "deleted"
      ? `machine deleted in ${result.provider}`
      : result.detail ?? "no machine to delete";

    return `${result.target}: ${machine}; record removed.\n`;
  }
}
