import { createHash } from "node:crypto";

import type { FactRedaction } from "../../Domain/FactDeclaration.js";

/**
 * What a snapshot is allowed to carry from output that may hold a secret.
 *
 * Applied where the output is produced rather than where it is stored: a secret
 * that reached the snapshot has already left the machine, and no amount of
 * filtering afterwards puts it back.
 */
export class Redaction {
  constructor(private readonly declared: FactRedaction | undefined) {}

  /** The text as it may be recorded, and nothing more. */
  apply(text: string): string {
    if (this.declared === undefined || this.declared.strategy === "none") {
      return text;
    }

    if (this.declared.strategy === "omit") {
      return "";
    }

    if (this.declared.strategy === "hash") {
      return createHash("sha256").update(text).digest("hex");
    }

    const patterns = this.declared.patterns ?? [];

    // Masking with nothing to match on would leave the output intact, which is
    // the opposite of what asking for masking means.
    if (patterns.length === 0) {
      return "[masked]";
    }

    return patterns.reduce((current, pattern) => current.replace(new RegExp(pattern, "g"), "[masked]"), text);
  }

  /** Whether anything was actually withheld, so a reader knows what it is looking at. */
  get redacted(): boolean {
    return this.declared !== undefined && this.declared.strategy !== "none";
  }
}
