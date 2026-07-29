/**
 * Whether a collection of facts got everything it was asked for.
 *
 * `success` is everything answered; `warning` is a machine that answered where something declared
 * failed — a command that would not run, a path that failed what was required of it, a user found
 * under another id. A machine that could not be read at all never produces facts, so `error` belongs
 * to a reading that got far enough to say so and not to one that threw.
 */
export type FactsStatus = "success" | "warning" | "error";
