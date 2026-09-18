/** A word for what a machine is that openstrap's vocabulary does not have. */
export class UnrecognisedMachineKindError extends Error {
  constructor(target: string, field: "scope" | "type", value: string, known: readonly string[]) {
    super(
      `The record of "${target}" says its ${field} is "${value}", which openstrap has no meaning for. `
      + `It knows ${known.join(", ")}. Whatever wrote that record and this openstrap disagree.`,
    );
    this.name = "UnrecognisedMachineKindError";
  }
}
