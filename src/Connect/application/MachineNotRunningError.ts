export class MachineNotRunningError extends Error {
  constructor(target: string, status: string) {
    super(`Machine "${target}" is ${status}. Start it before connecting.`);
    this.name = "MachineNotRunningError";
  }
}
