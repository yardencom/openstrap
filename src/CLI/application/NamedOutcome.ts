import type { CommandOutcome } from "./CliCommand.js";
import type { ConnectResult } from "./ConnectCommand.js";
import type { CreatedTarget } from "./CreateCommand.js";
import type { FactsCollectResult } from "./FactsCollectCommand.js";
import type { RunResult } from "./RunCommand.js";

/**
 * What a command produced, with the command that produced it.
 *
 * The name travels with the result so that anything acting on one can tell which it is
 * and be given the right type for it, without a cast and without asking. A command does
 * not add the name itself: it does not know it is one of several, and it should not.
 */
export type NamedOutcome =
  | ({ command: "run" } & CommandOutcome<RunResult>)
  | ({ command: "create" } & CommandOutcome<CreatedTarget>)
  | ({ command: "connect" } & CommandOutcome<ConnectResult>)
  | ({ command: "facts.collect" } & CommandOutcome<FactsCollectResult>);
