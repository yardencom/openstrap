import { ConvergeMachine } from "./application/ConvergeMachine.js";
import { Converging, type ConvergingResult } from "./application/Converging.js";
import type { BlueprintTarget } from "../../Modules/Blueprint/index.js";
import type { OpenStrapRuntime } from "../../Plugin/index.js";
import type { SqliteStateStore } from "../../StateStore/index.js";
import type { Target } from "#types/Target.js";

export type { ConvergingRequest, ConvergingResult } from "./application/Converging.js";
export { Converging } from "./application/Converging.js";

export type ConvergeRequest = {
  target: BlueprintTarget;
  runtime: OpenStrapRuntime;
  store: SqliteStateStore;
  /** Work out the plan and change nothing. */
  check?: boolean;
  maxPasses?: number;
  now?: Date;
};

export type ConvergeResult = ConvergingResult;

/**
 * `converge` — take a declared machine from what it is to what its blueprint says it is.
 *
 * The fourth stage as a whole, and the one decision this makes is where the loop turns: it always
 * turns where the machine is. A target with no provider is the machine openstrap is running on, and
 * the loop is here. A target with one is a machine openstrap created, and the loop is delivered there.
 *
 * That distinction is read from the target, not from what a caller called it. A command line saying
 * `converge host` and a blueprint declaring a host target under some other name are the same case,
 * and the thing that knows which case it is is the target's own provider — as it is in `run`.
 *
 * Starting a machine is not here. `create` makes machines and starts them; this brings a machine that
 * is running to what was declared. Two commands that both start machines would be two implementations
 * of adopting one.
 *
 * Reached from the command line and from `run`, which is why it is a feature and not a command. A run
 * that only checked was three stages of four; the fourth belongs to the same word a person types, and
 * a second copy of this dispatch living in the CLI would be the version that drifts.
 */
export class Converge {
  constructor(
    private readonly here = new Converging(),
    private readonly there = new ConvergeMachine(),
  ) {}

  execute(request: ConvergeRequest): Promise<ConvergeResult> {
    return request.target.provider === undefined
      ? this.here.execute({
        target: hostMachine(request.target),
        requirements: request.target.requirements,
        steps: request.target.steps,
        check: request.check,
        maxPasses: request.maxPasses,
        now: request.now,
      })
      : this.there.execute(request);
  }
}

/**
 * A target nobody made, which is the machine openstrap is on.
 *
 * `host` in both fields for the same reason a run says so: no provider means nothing created this and
 * nothing was reached to get to it. The name is the target's own — a blueprint may call this machine
 * `builder`, and calling it `host` here would report a reading under a name nobody declared.
 */
function hostMachine(target: BlueprintTarget): Target {
  return { name: target.name, scope: "host", type: "host", displayName: target.displayName };
}
