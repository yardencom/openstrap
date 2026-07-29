export class UnknownMachineError extends Error {
  constructor(target: string) {
    super(`openstrap has no record of a machine for target "${target}". Create it first with: openstrap create vm ${target}`);
    this.name = "UnknownMachineError";
  }
}
