import { Connect } from "#features/Connect/Connect.js";
import { RemoteOpenStrap } from "../../../Modules/RemoteOpenStrap/RemoteOpenStrap.js";
import { StepSecrets } from "./StepSecrets.js";
import { Requirements } from "../../../Modules/Requirements/index.js";
import { UnknownMachinePlatformError } from "../../../Modules/RemoteOpenStrap/errors/UnknownMachinePlatformError.js";
import { WrittenSteps, type BlueprintTarget } from "../../../Modules/Blueprint/index.js";
import type { ConvergingResult } from "./Converging.js";
import type { OpenStrapRuntime } from "../../../Plugin/index.js";
import type { OpenStrapServer } from "../../../Api/index.js";
import type { Store } from "../../../Store/index.js";
import type { Target } from "#types/Target.js";

export type ConvergeMachineRequest = {
  target: BlueprintTarget;
  runtime: OpenStrapRuntime;
  store?: Store;
  server?: OpenStrapServer;
  check?: boolean;
  maxPasses?: number;
  /** Where the blueprint is, because what it says to deliver is named relative to itself. */
  now?: Date;
};

/** A machine openstrap created, brought to what the blueprint declares by openstrap on it. */
export class ConvergeMachine {
  async execute(request: ConvergeMachineRequest): Promise<ConvergingResult> {
    const declared = request.target;
    const secrets = new StepSecrets(request.runtime.secretStores.soleIfAny());
    const connection = await new Connect().execute({
      target: declared.name,
      runtime: request.runtime,
      store: request.store,
      server: request.server,
    });

    try {
      // Asked of whatever holds the record, which `Connect` has already been to: what kind of machine
      // this is decides which build of openstrap is delivered, and a build is for one platform.
      if (connection.machine === undefined) {
        throw new UnknownMachinePlatformError(declared.name);
      }

      const machine: Target = {
        name: declared.name,
        ...connection.kind,
        displayName: declared.displayName,
      };
      // Before the steps, because a step that uses what was delivered cannot deliver it: openstrap
      // holds the transport here and the machine has no way to reach back for anything.

      const converged = await new RemoteOpenStrap(connection.transport, connection.machine).converge({
        target: machine,
        requirements: declared.requirements,
        steps: declared.steps && WrittenSteps.asWritten(declared.steps),
        // Fetched here, because the store is here: a delivered openstrap has no store to ask.
        secrets: await secrets.forDelivery(declared.steps ?? []),
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
