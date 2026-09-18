import type { FactDeclaration } from "./FactDeclaration.js";
import type { Target } from "./Target.js";

/** The channel a snapshot was read through, as whatever opened it reported. */
export type FactChannel = {
  type: string;
  authMethods?: readonly string[];
};

/** One machine to read, and what to ask it about. */
export type FactOrder = {
  target: Target;
  declare?: FactDeclaration;
  channel?: FactChannel;
  /** Fixes the snapshot's time and id, so the same reading can be asked for twice. */
  now?: Date;
};
