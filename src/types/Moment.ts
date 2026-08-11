/** A moment, as facts record one. */
export class Moment {
  private readonly at: Date;

  constructor(at: Date) {
    this.at = new Date(at.getTime());

    Object.freeze(this);
  }

  /** Now, for callers that are not reproducing a particular moment. */
  static now(): Moment {
    return new Moment(new Date());
  }

  /** A moment as it came back from JSON, which is the text of one. */
  static of(text: string): Moment {
    const at = new Date(text);

    if (Number.isNaN(at.getTime())) {
      throw new TypeError(`Not a moment: ${JSON.stringify(text)}`);
    }

    return new Moment(at);
  }

  /** The same instant with nothing in it a name cannot carry. */
  stamp(): string {
    return this.at.toISOString().replace(/[-:.]/g, "");
  }

  toJSON(): string {
    return this.at.toISOString();
  }

  toString(): string {
    return this.at.toISOString();
  }
}
