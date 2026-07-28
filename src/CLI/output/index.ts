import type { ParsedArgs } from "../Arguments/index.js";
import { JsonOutput } from "./json/JsonOutput.js";
import { TextOutput } from "./text/TextOutput.js";
import type { Output } from "./types.js";

export type { CommandText, Output } from "./types.js";

/**
 * The output the caller asked for.
 *
 * `connect` has no `--json` to ask for, so it is only ever read as text: what it hands back is the
 * machine's own output, and openstrap reformatting that would be talking over the answer.
 */
export function output(args: ParsedArgs): Output {
  return "json" in args && args.json ? new JsonOutput() : new TextOutput();
}
