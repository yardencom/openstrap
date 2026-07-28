import type { ParsedArgs } from "../Arguments/index.js";
import type { CommandText } from "./CommandText.js";
import { ConnectText } from "./ConnectText.js";
import { CreateText } from "./CreateText.js";
import { FactsText } from "./FactsText.js";
import type { Output } from "./Output.js";
import { RunText } from "./RunText.js";

/**
 * A result as a person reads it, in the words of the command that produced it.
 *
 * Which of them reads a given result is all this decides; each command's own words are their own
 * class. A command added to the command line has to appear here, or its result has nothing to
 * read it by.
 */
export class TextOutput implements Output {
  private readonly commands: Record<ParsedArgs["command"], CommandText<never>> = {
    "run": new RunText(),
    "create": new CreateText(),
    "connect": new ConnectText(),
    "facts.collect": new FactsText(),
  };

  /**
   * The result arrives untyped, because one map cannot hold four different result types under one
   * value type. The pairing is asserted here and only here, and it is right by construction: the
   * key that chose the text is the key the command answered under.
   */
  print(command: ParsedArgs["command"], result: unknown): string {
    return this.commands[command].print(result as never);
  }
}
