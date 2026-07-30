/**
 * A moment, as facts record one.
 *
 * A type of its own rather than a `Date` or a string, because the two things openstrap does with a
 * moment are exactly the two a bare value gets wrong: it writes it into a name, and it writes it into
 * JSON. A `Date` in JSON is whatever `JSON.stringify` decides; a string is a moment nobody can
 * compare. Here both spellings come from the same instant, so a snapshot's name and its time can
 * never disagree.
 */
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

  /**
   * The same instant with nothing in it a name cannot carry.
   *
   * Ids are read by people and typed into queries, so the separators go rather than being escaped
   * later by whoever uses one.
   */
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
