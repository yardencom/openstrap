import type { NamedOutcome } from "../application/NamedOutcome.js";
import { renderCreateOutput } from "./CreateOutput.js";
import { renderFactsOutput } from "./FactsOutput.js";
import { renderRunOutput } from "./RunOutput.js";

/**
 * How a command's result is presented.
 *
 * One question — what does this result look like — and one method to answer it. It used
 * to have a method per command, which is four operations wearing one name and an
 * interface that grows with the command list.
 *
 * The outcome carries the name of the command that produced it, so an implementation that
 * needs to tell them apart can, and one that does not can ignore it.
 */
export interface CommandOutput {
  present(outcome: NamedOutcome): string;
}

/**
 * The result as a program reads it: the thing itself, indented, one trailing newline.
 *
 * The same for every command, because JSON of a result is the result. Nothing here needs
 * to know which command answered.
 */
export class JsonOutput implements CommandOutput {
  present(outcome: NamedOutcome): string {
    return `${JSON.stringify(outcome.result, null, 2)}\n`;
  }
}

/**
 * The result as a person reads it, each command in its own words.
 *
 * This is the one place that knows which words belong to which result, and it knows it by
 * the name the outcome carries — so every branch has the right type without a cast, and a
 * command added to the union will not compile until it reads as something.
 */
export class TextOutput implements CommandOutput {
  present(outcome: NamedOutcome): string {
    switch (outcome.command) {
      case "run":
        return renderRunOutput(outcome.result);
      case "create":
        return renderCreateOutput(outcome.result);
      case "connect":
        // What the machine said, unchanged: openstrap adding anything around it would be
        // talking over the answer.
        return outcome.result.output;
      case "facts.collect":
        return renderFactsOutput(outcome.result);
    }
  }
}
