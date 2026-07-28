import type { CreatedTarget } from "../application/CreateCommand.js";
import type { ConnectResult } from "../application/ConnectCommand.js";
import type { FactsCollectResult } from "../application/FactsCollectCommand.js";
import type { RunResult } from "../application/RunCommand.js";
import { renderCreateOutput } from "./CreateOutput.js";
import { renderFactsOutput } from "./FactsOutput.js";
import { renderRunOutput } from "./RunOutput.js";

/**
 * How a command's result is presented.
 *
 * One method per command rather than one that takes anything, so every result arrives
 * with its own type and nothing is cast on the way in. Adding a command adds a method
 * here, and every way of presenting one has to answer for it or fail to compile.
 *
 * Commands know nothing about this. They produce a result; what it looks like is chosen
 * once, from what the caller asked for.
 */
export interface CommandOutput {
  run(result: RunResult): string;
  create(result: CreatedTarget): string;
  connect(result: ConnectResult): string;
  factsCollect(result: FactsCollectResult): string;
}

/**
 * The result as a program reads it: the thing itself, indented, one trailing newline.
 *
 * Every command is presented the same way, because JSON of a result is the result —
 * there is nothing to decide per command, and anything openstrap can say to a person it
 * can also say to a script.
 */
export class JsonOutput implements CommandOutput {
  run(result: RunResult): string {
    return this.of(result);
  }

  create(result: CreatedTarget): string {
    return this.of(result);
  }

  connect(result: ConnectResult): string {
    return this.of(result);
  }

  factsCollect(result: FactsCollectResult): string {
    return this.of(result);
  }

  private of(result: unknown): string {
    return `${JSON.stringify(result, null, 2)}\n`;
  }
}

/** The result as a person reads it, each command in its own words. */
export class TextOutput implements CommandOutput {
  run(result: RunResult): string {
    return renderRunOutput(result);
  }

  create(result: CreatedTarget): string {
    return renderCreateOutput(result);
  }

  /**
   * What the machine said, unchanged.
   *
   * `connect --run` hands back the machine's own output, and openstrap adding anything
   * around it would be talking over the answer.
   */
  connect(result: ConnectResult): string {
    return result.output;
  }

  factsCollect(result: FactsCollectResult): string {
    return renderFactsOutput(result);
  }
}
