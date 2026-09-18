import type { Asked } from "#types/FactDeclaration.js";
import type { FactSections } from "#types/Facts.js";
import type { Platform } from "../platform/Platform.js";

/** Which instruction set this machine runs. */
export class ArchFacts {
  constructor(private readonly platform: Platform) {}

  arch(declared: Asked | undefined): FactSections["arch"] {
    return declared === undefined ? undefined : this.platform.architecture;
  }
}
