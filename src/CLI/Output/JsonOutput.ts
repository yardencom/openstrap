import type { Output } from "./Output.js";

/**
 * A result as a program reads it: the thing itself, indented, one trailing newline.
 *
 * The same for every command, because JSON of a result is the result — which is why the command
 * it came from is of no interest here.
 */
export class JsonOutput implements Output {
  print(_command: string, result: unknown): string {
    return JSON.stringify(result, null, 2);
  }
}
