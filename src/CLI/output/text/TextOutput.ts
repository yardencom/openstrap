import type { ParsedArgs } from "../../arguments/index.js";
import type { CommandText, Output } from "../types.js";
import { ConnectText } from "./ConnectText.js";
import { ConvergeText } from "./ConvergeText.js";
import { CreateText } from "./CreateText.js";
import { FactsText } from "./FactsText.js";
import { ListText } from "./ListText.js";
import { RunText } from "./RunText.js";

/**
 * A result as a person reads it, in the words of the command that produced it. All this decides is which —
 * and a command added to the command line has to appear here or its result cannot be read.
 */
export class TextOutput implements Output {
  private readonly commands: Record<ParsedArgs["command"], CommandText<never>> = {
    "run": new RunText(),
    "create": new CreateText(),
    "connect": new ConnectText(),
    "converge": new ConvergeText(),
    "list": new ListText(),
    "facts.collect": new FactsText(),
  };

  /** The result arrives untyped, because one map cannot hold four different result types under one value type. */
  print(command: ParsedArgs["command"], result: unknown): string {
    return this.commands[command].print(result as never);
  }
}
