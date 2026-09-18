export class ServicesNeedAMachineError extends Error {
  constructor(target: string) {
    super(`"${target}" declares services but no provider; services run on a machine openstrap makes, not on this one`);
    this.name = "ServicesNeedAMachineError";
  }
}
