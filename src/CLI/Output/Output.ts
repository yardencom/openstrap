import type { ParsedArgs } from "../Arguments/index.js";

/**
 * What a command's result is turned into.
 *
 * The command's name comes with the result because a result on its own does not say which
 * command produced it, and how it reads depends on that. An implementation that does not care
 * ignores it.
 *
 * Nothing but the contract lives here: an implementation has to import it, so a file that also
 * chose between implementations would have to import them back.
 */
export interface Output {
  print(command: ParsedArgs["command"], result: unknown): string;
}
