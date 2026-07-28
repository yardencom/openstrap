import type { FactDeclaration } from "./FactDeclaration.js";
import type { FactTarget } from "./FactTarget.js";

/** One machine to read, and what to ask it about. */
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

/**
 * One machine to read, with the questions taken from a facts definition file.
 *
 * A separate order because a definition brings more than a declaration: it has an
 * identity and a version worth reporting, its inputs can be overridden, and its
 * relative paths mean something only next to the workspace it was found in.
 */
export type DefinitionFactOrder = {
  target: FactTarget;
  /** Path to the definition file. */
  path: string;
  /** Values for the definition's inputs, which win over its own defaults. */
  inputs?: Record<string, string>;
  /** What a relative path in the definition is relative to. */
  workspaceRoot: string;
  now?: Date;
  attempt?: number;
};

