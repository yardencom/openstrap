import type { FactSections } from "./FactModel.js";

/** Whether the collection got everything it was asked for. */
export type FactsStatus = "success" | "warning" | "error";

/**
 * The facts about one machine.
 *
 * An instance and not a bag of sections, because there is something only the facts themselves can
 * answer — whether everything asked for came back — and that answer has to live where the sections
 * are. It used to be worked out by whatever held them, which meant a snapshot deciding a question
 * about facts it was only carrying.
 *
 * The sections are its own properties rather than something it wraps, so the facts and their JSON are
 * the same shape: `facts.os.name` here is `facts.os.name` in the snapshot openstrap printed on
 * another machine, and requirements are written against one spelling. That is what the interface
 * below is for — it gives the class the sections in the type system, `Object.assign` gives them at
 * runtime, and methods are not enumerable so they never reach the JSON.
 */
export interface MachineFacts extends FactSections {}

export class MachineFacts {
  constructor(sections: FactSections) {
    Object.assign(this, sections);

    freeze(this);
  }

  /** Facts as they came back from JSON, which openstrap on another machine collected. */
  static of(sections: unknown): MachineFacts {
    if (!sections || typeof sections !== "object" || Array.isArray(sections)) {
      throw new TypeError("Not a set of fact sections");
    }

    return new MachineFacts(sections as FactSections);
  }

  /**
   * Whether everything asked for came back.
   *
   * A machine that could not be read at all never gets this far — that is an exception. What is left
   * is a machine that answered, where some declared thing failed: a command that would not run, a
   * path that failed what was required of it, a user found under another id. The facts are still
   * usable, so it is a warning rather than a failure, and the reason sits on the section that failed.
   *
   * Found by walking the sections rather than by a list of them to look in. A list is a thing to
   * forget: `users` was added to the model and not to the list, and facts holding a failed user read
   * as a clean collection.
   */
  status(): FactsStatus {
    return statusOf({ ...this });
  }
}

function statusOf(value: unknown): FactsStatus {
  if (!value || typeof value !== "object") {
    return "success";
  }

  if (!Array.isArray(value) && (value as { status?: unknown }).status === "error") {
    return "warning";
  }

  return Object.values(value).some((property) => statusOf(property) === "warning") ? "warning" : "success";
}

function freeze(value: unknown): void {
  if (!value || typeof value !== "object") {
    return;
  }

  Object.freeze(value);

  for (const property of Object.values(value)) {
    freeze(property);
  }
}
