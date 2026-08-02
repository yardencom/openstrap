import type { TargetScope, TargetType } from "#types/Target.js";

/**
 * A provider that can make more than one kind of machine, asked to make one.
 *
 * Which kind it is has to be written on the machine — a snapshot says whether it is about a guest
 * or a container, and a requirement is checked against a machine of a stated kind. Taking the first
 * of what the provider says it is able to make would be openstrap deciding, and it is not the one
 * that knows.
 */
export class AmbiguousMachineKindError extends Error {
  constructor(provider: string, scopes: readonly TargetScope[], types: readonly TargetType[]) {
    super(
      `Provider "${provider}" makes machines of more than one kind (scopes: ${scopes.join(", ")}; ` +
      `types: ${types.join(", ")}), so which one a target is cannot be told from the provider alone`,
    );
    this.name = "AmbiguousMachineKindError";
  }
}
