/**
 * The part of a command line that is openstrap's rather than a command's.
 *
 * Three things, and they have to be read before anything else can be: which plugins to load, and
 * whether the answer is for a person or for a program. The plugins decide which words exist at all,
 * so they cannot be discovered by a parser that would first have to know the word.
 *
 * Read by scanning rather than by a grammar, because at this point there is no grammar: every other
 * option on the line belongs to a command that has not been found yet. Anything not recognised here
 * is left alone and handed on untouched.
 */
export class GlobalOptions {
  private readonly args: readonly string[];

  constructor(argv: readonly string[]) {
    this.args = argv.slice(2);
  }

  /** The first word that is not an option: whoever owns it owns the rest of the line. */
  command(): string | undefined {
    return this.args.find((argument) => !argument.startsWith("-") && !this.isValueOf(argument));
  }

  /** Everything after that word, which is the command's own to read — including the options above. */
  rest(): readonly string[] {
    const word = this.command();

    return word === undefined ? [] : this.args.slice(this.args.indexOf(word) + 1);
  }

  json(): boolean {
    return this.args.includes("--json");
  }

  runtimeConfigPath(): string | undefined {
    return this.value("--runtime-config");
  }

  /** Plugin modules named on the command line, added to the ones the project always has. */
  pluginSpecifiers(): string[] {
    return this.args.flatMap((argument, index) => {
      if (argument.startsWith("--plugin=")) {
        return [argument.slice("--plugin=".length)];
      }

      return argument === "--plugin" && this.args[index + 1] ? [this.args[index + 1]!] : [];
    });
  }

  private value(name: string): string | undefined {
    const joined = this.args.find((argument) => argument.startsWith(`${name}=`));

    if (joined) {
      return joined.slice(name.length + 1);
    }

    const index = this.args.indexOf(name);

    return index === -1 ? undefined : this.args[index + 1];
  }

  /** A word that is the value of one of the options above, and so is not the command. */
  private isValueOf(argument: string): boolean {
    const index = this.args.indexOf(argument);

    return index > 0 && ["--runtime-config", "--plugin"].includes(this.args[index - 1]!);
  }
}
