import type { Output } from "../types.js";

/** The thing itself, indented, one trailing newline. Which command it came from is of no interest. */
export class JsonOutput implements Output {
  print(_command: string, result: unknown): string {
    return JSON.stringify(result, null, 2);
  }
}
