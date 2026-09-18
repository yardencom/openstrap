export class ServicesNotReadyError extends Error {
  constructor(readonly reasons: Readonly<Record<string, string>>) {
    super(Object.entries(reasons).map(([name, reason]) => `${name}: ${reason}`).join("; "));
    this.name = "ServicesNotReadyError";
  }
}
