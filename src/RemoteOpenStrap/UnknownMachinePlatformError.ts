/**
 * A machine openstrap has no record of the kind of.
 *
 * What a target is gets written down when openstrap creates it, from the image it was made from. A
 * target without that record is one openstrap has not created — or created before it started keeping
 * the record — and guessing from the machine is what this replaced.
 */
export class UnknownMachinePlatformError extends Error {
  constructor(target: string) {
    super(
      `openstrap has no record of what kind of machine "${target}" is, so it cannot tell which build `
      + `of itself to deliver there. Create it with: openstrap create vm ${target}`,
    );
    this.name = "UnknownMachinePlatformError";
  }
}
