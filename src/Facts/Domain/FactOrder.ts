import type { FactDeclaration } from "./FactDeclaration.js";
import type { FactTarget } from "./FactTarget.js";

/**
 * One machine to read, and what to ask it about.
 *
 * The questions arrive one of two ways: named inline by a caller that knows them,
 * or by reference to a facts definition file that holds them. Both are the same
 * thing said differently, which is why they are one order and not two ways in.
 * Saying them twice is a caller that has not decided, and is refused.
 */
export type FactOrder = {
  target: FactTarget;
  declare?: FactDeclaration;
  definition?: FactDefinitionSource;
  /**
   * When the run started, for callers that need reproducible identifiers.
   *
   * Snapshot and run ids are stamped from it, so a test can ask for the same
   * snapshot twice and get the same name for it.
   */
  now?: Date;
  attempt?: number;
};

/** A facts definition file to take the questions from. */
export type FactDefinitionSource = {
  path: string;
  /** Values for the definition's inputs, which win over its own defaults. */
  inputs?: Record<string, string>;
  /** What a relative path in the definition is relative to. */
  workspaceRoot: string;
};

export class ContradictoryFactOrderError extends Error {
  constructor() {
    super("A fact order names its questions inline and in a definition file; it must do one or the other");
    this.name = "ContradictoryFactOrderError";
  }
}
