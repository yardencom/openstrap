import type { FactDeclaration } from "./FactDeclaration.js";
import type { FactTarget } from "./FactTarget.js";

/**
 * The channel a snapshot was read through, as the thing that opened it reported.
 *
 * Given by the caller because nothing on a machine can answer it: a machine does not know how anyone
 * got in. Absent when nobody opened a channel, and then the snapshot says nothing about one — a guess
 * would be a fabricated fact, and requirements are written against this.
 */
export type FactChannel = {
  type: string;
  authMethods?: readonly string[];
};

/**
 * One machine to read, and what to ask it about.
 *
 * Naming nothing is a legitimate order: it means "tell me about this machine", and
 * the collection answers with everything it can without being told a name. The
 * sections that hold named things stay empty, because nobody asked about anything
 * in them and inventing entries would be inventing facts.
 */
export type FactOrder = {
  target: FactTarget;
  declare?: FactDeclaration;
  channel?: FactChannel;
  /**
   * What to stamp the snapshot with, for callers that need a reproducible name.
   *
   * The snapshot's time and its id are both taken from it, so a test can ask for
   * the same snapshot twice and get the same name for it. Left out, the clock is
   * read once the machine has answered.
   */
  now?: Date;
};
