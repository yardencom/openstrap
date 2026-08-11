import { Connect, UnknownMachineError } from "#features/Connect/Connect.js";
import { RemoteOpenStrap } from "../../../Modules/RemoteOpenStrap/RemoteOpenStrap.js";
import { StepSecrets } from "./StepSecrets.js";
import { Requirements } from "../../../Modules/Requirements/index.js";
import { UnknownMachinePlatformError } from "../../../Modules/RemoteOpenStrap/errors/UnknownMachinePlatformError.js";
import { WrittenSteps, type BlueprintTarget } from "../../../Modules/Blueprint/index.js";
import type { ConvergingResult } from "./Converging.js";
import type { OpenStrapRuntime } from "../../../Plugin/index.js";
import type { SqliteStateStore } from "../../../StateStore/index.js";
import type { Target } from "#types/Target.js";

export type ConvergeMachineRequest = {
  target: BlueprintTarget;
  runtime: OpenStrapRuntime;
  store: SqliteStateStore;
  check?: boolean;
  maxPasses?: number;
  now?: Date;
};

/** A machine openstrap created, brought to what the blueprint declares by openstrap on it. */
export class ConvergeMachine {
  constructor(private readonly secrets = new StepSecrets()) {}

  async execute(request: ConvergeMachineRequest): Promise<ConvergingResult> {
    const declared = request.target;
    const recorded = request.store.readTarget(declared.name);
    const platform = request.store.readMachineImage(declared.name);

    if (recorded === null) {
      throw new UnknownMachineError(declared.name);
    }

    if (platform === null) {
      throw new UnknownMachinePlatformError(declared.name);
    }

    const machine: Target = {
      name: declared.name,
      scope: recorded.scope,
      type: recorded.type,
      displayName: declared.displayName,
    };
    const connection = await new Connect().execute({
      target: declared.name,
      runtime: request.runtime,
      store: request.store,
    });

    try {
      const converged = await new RemoteOpenStrap(connection.transport, platform).converge({
        target: machine,
        requirements: declared.requirements,
        steps: declared.steps && WrittenSteps.asWritten(declared.steps),
        // Fetched here, because the store is here: a delivered openstrap has no keychain to ask.
        secrets: await this.secrets.forDelivery(declared.steps ?? []),
        check: request.check,
        maxPasses: request.maxPasses,
        channel: { type: connection.access.transport, authMethods: connection.transport.authMethods },
        now: request.now,
      });

      return {
        ...converged,
        requirementRun: new Requirements(declared.requirements).checkedAgainst({
          target: machine,
          snapshots: [converged.snapshot],
          attempt: converged.passes.length + 1,
          trigger: "converge",
          purpose: "converge",
          now: request.now,
        }),
      };
    } finally {
      await connection.close();
    }
  }
}
