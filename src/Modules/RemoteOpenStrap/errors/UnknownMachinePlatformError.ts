/** A machine openstrap has no record of the kind of. */
export class UnknownMachinePlatformError extends Error {
  constructor(target: string) {
    super(
      `openstrap has no record of what kind of machine "${target}" is, so it cannot tell which build `
      + `of itself to deliver there. Create it with: openstrap create vm ${target}`,
    );
    this.name = "UnknownMachinePlatformError";
  }
}
