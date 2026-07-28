import type { FactDeclaration } from "./FactDeclaration.js";
import type { FactTarget } from "./FactTarget.js";

/**
 * One machine to read, and what to ask it about.
 *
 * Naming nothing is a legitimate order: it means "tell me about this machine", and
 * the reading answers with everything it can without being told a name. The
 * sections that hold named things stay empty, because nobody asked about anything
 * in them and inventing entries would be inventing facts.
 */
export type FactOrder = {
  target: FactTarget;
  declare?: FactDeclaration;
  /**
   * When the run started, for callers that need reproducible identifiers.
   *
   * Snapshot and run ids are stamped from it, so a test can ask for the same
   * snapshot twice and get the same name for it.
   */
  now?: Date;
  attempt?: number;
};
