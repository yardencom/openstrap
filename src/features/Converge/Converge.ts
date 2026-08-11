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

/** `converge` — take a declared machine from what it is to what its blueprint says it is. */
export class Converge {
  constructor(
    private readonly here = new Converging(),
    private readonly there = new ConvergeMachine(),
  ) {}

  execute(request: ConvergeRequest): Promise<ConvergeResult> {
    return request.target.provider === undefined
      ? this.here.execute({
        target: Converge.hostMachine(request.target),
        requirements: request.target.requirements,
        steps: request.target.steps,
        check: request.check,
        maxPasses: request.maxPasses,
        now: request.now,
      })
      : this.there.execute(request);
  }

  /** A target nobody made, which is the machine openstrap is on. */
  private static hostMachine(target: BlueprintTarget): Target {
    return { name: target.name, scope: "host", type: "host", displayName: target.displayName };
  }
}
