/** Merging zero runs: a run has an identity and a start, and neither can be made out of nothing. */
export class MergedRunWithoutTargetsError extends Error {
  constructor() {
    super("A requirement run needs at least one target to merge");
    this.name = "MergedRunWithoutTargetsError";
  }
}
