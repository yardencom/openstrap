import type { ParsedArgs } from "../Arguments/index.js";
import { JsonOutput } from "./JsonOutput.js";
import { TextOutput } from "./TextOutput.js";

/**
 * What a command's result is turned into.
 *
 * The command's name comes with the result because a result on its own does not say which
 * command produced it, and how it reads depends on that. An implementation that does not care
 * ignores it.
 */
export interface Output {
  describe(command: ParsedArgs["command"], result: unknown): string;
}

/** The output the caller asked for. `connect` has no `--json`, so it is only ever read as text. */
export function output(args: ParsedArgs): Output {
  return "json" in args && args.json ? new JsonOutput() : new TextOutput();
}
