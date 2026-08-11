/** A machine about to be made, and nothing to write it down in. */
export class NowhereToRecordError extends Error {
  constructor(target: string) {
    super(
      `There is nowhere to record "${target}": no openstrap-server was named and no local store was `
      + "opened. A machine that exists and is written down nowhere is one nothing can find again.",
    );
    this.name = "NowhereToRecordError";
  }
}
