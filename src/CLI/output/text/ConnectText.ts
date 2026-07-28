import type { ConnectResult } from "../../application/ConnectCommand.js";
import type { CommandText } from "../types.js";

/**
 * What the machine said, unchanged.
 *
 * `connect --run` hands back the machine's own output, and openstrap adding anything
 * around it would be talking over the answer.
 */
export class ConnectText implements CommandText<ConnectResult> {
  print(result: ConnectResult): string {
    return result.output;
  }
}
