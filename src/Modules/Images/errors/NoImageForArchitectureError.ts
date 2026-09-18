/**
 * The image exists and was not built for this machine.
 *
 * Said apart from a name nobody published, because the two are answered differently: one is a
 * different name to write, the other is a machine that cannot run it without emulating another.
 */
export class NoImageForArchitectureError extends Error {
  constructor(reference: string, architecture: string, available: readonly string[], tag?: string) {
    const has = available.length === 0
      ? "It is published for no architecture openstrap can boot."
      : `It is published for ${available.join(", ")}.`;

    super(
      `${tag ?? reference} has no image for ${architecture}. ${has}`,
    );
    this.name = "NoImageForArchitectureError";
  }
}
