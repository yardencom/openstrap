/**
 * How a command's result is presented.
 *
 * One question — what does this result look like — and two answers, so adding a command
 * touches neither this nor anything that implements it. It used to have a method per
 * command, which meant four operations wearing one name and an interface that grew with
 * the command list.
 *
 * Both are handed everything either might need: the result, and the way that result reads
 * for a person. Which of the two matters is the whole difference between them.
 */
export interface CommandOutput {
  present<TResult>(result: TResult, asText: (result: TResult) => string): string;
}

/**
 * The result as a program reads it: the thing itself, indented, one trailing newline.
 *
 * The same for every command, because JSON of a result is the result — there is nothing
 * to decide per command, which is why the rendering is ignored here.
 */
export class JsonOutput implements CommandOutput {
  present<TResult>(result: TResult): string {
    return `${JSON.stringify(result, null, 2)}\n`;
  }
}

/** The result as a person reads it, in the words the command's own rendering gives it. */
export class TextOutput implements CommandOutput {
  present<TResult>(result: TResult, asText: (result: TResult) => string): string {
    return asText(result);
  }
}
