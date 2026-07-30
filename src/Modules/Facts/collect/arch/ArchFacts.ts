import type { FactSections } from "#types/Facts.js";
import type { Platform } from "../platform/Platform.js";

/** Which instruction set this machine runs. */
export class ArchFacts {
  constructor(private readonly platform: Platform) {}

  arch(declared: Record<string, never> | undefined): FactSections["arch"] {
    return declared === undefined ? undefined : this.platform.architecture;
  }
}
