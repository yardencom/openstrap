import type { ParsedArgs } from "../arguments/index.js";
import { JsonOutput } from "./json/JsonOutput.js";
import { TextOutput } from "./text/TextOutput.js";
import type { Output } from "./types.js";

export type { CommandText, Output } from "./types.js";

/** `connect` has no `--json`: what it hands back is the machine's own output, not openstrap's. */
export class Outputs {
  static for(args: ParsedArgs): Output {
    return "json" in args && args.json ? new JsonOutput() : new TextOutput();
  }
}
