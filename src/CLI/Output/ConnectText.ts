import type { ConnectResult } from "../application/ConnectCommand.js";
import type { CommandText } from "./CommandText.js";

/**
 * What the machine said, unchanged.
 *
 * `connect --run` hands back the machine's own output, and openstrap adding anything
 * around it would be talking over the answer.
 */
export class ConnectText implements CommandText<ConnectResult> {
  of(result: ConnectResult): string {
    return result.output;
  }
}
