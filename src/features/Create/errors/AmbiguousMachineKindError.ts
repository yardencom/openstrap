import type { TargetScope, TargetType } from "#types/Target.js";

/** A provider that can make more than one kind of machine, asked to make one. */
export class AmbiguousMachineKindError extends Error {
  constructor(provider: string, scopes: readonly TargetScope[], types: readonly TargetType[]) {
    super(
      `Provider "${provider}" makes machines of more than one kind (scopes: ${scopes.join(", ")}; ` +
      `types: ${types.join(", ")}), so which one a target is cannot be told from the provider alone`,
    );
    this.name = "AmbiguousMachineKindError";
  }
}
