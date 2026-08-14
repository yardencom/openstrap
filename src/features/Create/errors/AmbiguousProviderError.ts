/** More than one hypervisor could make this machine, and nothing said which. */
export class AmbiguousProviderError extends Error {
  constructor(providers: readonly string[]) {
    super(
      providers.length === 0
        ? "No provider plugin is configured, so there is nothing to make a machine with."
        : `More than one provider could make this machine (${providers.join(", ")}). `
          + `Say which with --provider ${providers[0]}.`,
    );
    this.name = "AmbiguousProviderError";
  }
}
