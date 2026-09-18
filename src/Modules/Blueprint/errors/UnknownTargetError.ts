export class UnknownTargetError extends Error {
  constructor(name: string, declared: readonly string[]) {
    super(`Target "${name}" is not declared in the blueprint. Declared targets: ${declared.join(", ")}`);
    this.name = "UnknownTargetError";
  }
}
