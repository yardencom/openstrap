type Stream = { isTTY?: boolean };

/** Colour where a person is looking, and none where a program is: NO_COLOR, a pipe or a dumb terminal all mean plain. */
export class Palette {
  private constructor(private readonly on: boolean) {}

  static plain(): Palette {
    return new Palette(false);
  }

  static forStream(stream: Stream, environment: NodeJS.ProcessEnv = process.env): Palette {
    if (environment.NO_COLOR !== undefined && environment.NO_COLOR !== "") {
      return Palette.plain();
    }

    if (environment.FORCE_COLOR !== undefined && environment.FORCE_COLOR !== "" && environment.FORCE_COLOR !== "0") {
      return new Palette(true);
    }

    return new Palette(stream.isTTY === true && environment.TERM !== "dumb");
  }

  bold(text: string): string {
    return this.wrap("1", text);
  }

  dim(text: string): string {
    return this.wrap("2", text);
  }

  red(text: string): string {
    return this.wrap("31", text);
  }

  green(text: string): string {
    return this.wrap("32", text);
  }

  yellow(text: string): string {
    return this.wrap("33", text);
  }

  magenta(text: string): string {
    return this.wrap("35", text);
  }

  private wrap(code: string, text: string): string {
    return this.on && text.length > 0 ? `[${code}m${text}[0m` : text;
  }
}
