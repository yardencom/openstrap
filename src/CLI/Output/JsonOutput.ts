/**
 * A result printed for a program rather than a person.
 *
 * `--json` prints the command's result itself instead of its rendering, so anything
 * openstrap can say a person can also parse. The formatting lives here because three
 * commands offer it and three copies would be free to disagree about the indentation
 * or the trailing newline.
 */
export function asJson(result: unknown): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
