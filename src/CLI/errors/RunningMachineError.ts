export class RunningMachineError extends Error {
  constructor(name: string) {
    super(`"${name}" is running; stop it first, or pass --force to delete it as it runs`);
    this.name = "RunningMachineError";
  }
}
