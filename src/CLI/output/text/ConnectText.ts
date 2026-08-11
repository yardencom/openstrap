import type { ConnectResult } from "../../application/ConnectCommand.js";
import type { CommandText } from "../types.js";

/** What the machine said, unchanged: anything added around it is openstrap talking over the answer. */
export class ConnectText implements CommandText<ConnectResult> {
  print(result: ConnectResult): string {
    return result.output;
  }
}
