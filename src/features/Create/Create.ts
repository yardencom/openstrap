import type { BlueprintTarget } from "../../Modules/Blueprint/index.js";
import type { OpenStrapRuntime } from "../../Plugin/index.js";
import type { RequirementRun } from "../../Modules/Requirements/index.js";
import type { SqliteStateStore } from "../../StateStore/index.js";
import { CreateMachine, type CreateMachineResult } from "./application/CreateMachine.js";
import { MissingProviderError } from "./errors/MissingProviderError.js";
import { VerifyMachine } from "./application/VerifyMachine.js";

export type { CreateMachineResult, CreateStep } from "./application/CreateMachine.js";
export { ProviderUnavailableError } from "./errors/ProviderUnavailableError.js";
export { MissingProviderError } from "./errors/MissingProviderError.js";

export type CreateRequest = {
  target: BlueprintTarget;
  runtime: OpenStrapRuntime;
  store: SqliteStateStore;
  hostPort: number;
  repin?: boolean;
  now?: Date;
};

/** A machine brought into being, and what it turned out to be. */
export type CreateResult = CreateMachineResult & {
  requirementRun?: RequirementRun;
};

/**
 * `create` — bring a declared target into being, and confirm it is what it promised.
 *
 * One action and not two. A machine that is up but was never checked is not what anyone asked for by
 * declaring requirements, and a caller left to run the check itself is a caller that decides when to
 * skip it. That decision used to live in the CLI, along with looking up the machine's key and naming
 * the channel to verify over — and it named `ssh` in a literal while the target declared its own
 * transport, so the two could only agree by coincidence.
 *
 * Verifying reads the machine itself: openstrap is delivered there and asked, and what comes back is
 * compared with what the blueprint required. That is why it belongs here rather than beside it — a
 * created machine and a read machine are the same machine, and nothing between them should be able to
 * lose that.
 */
export class Create {
  constructor(
    private readonly machines = new CreateMachine(),
    private readonly verification = new VerifyMachine(),
  ) {}

  async execute(request: CreateRequest): Promise<CreateResult> {
    const target = request.target;

    if (!target.provider) {
      throw new MissingProviderError(target.name);
    }

    const created = await this.machines.execute({
      target,
      provider: request.runtime.providers.require(target.provider),
      store: request.store,
      repin: request.repin,
      hostPort: request.hostPort,
      now: request.now,
    });

    // Nothing was required of it, so there is nothing to verify and nothing to report: the machine is
    // up, which is all that was asked.
    if (target.requirements.length === 0) {
      return created;
    }

    const identity = request.store.readSecretReference(target.name, "ssh-identity");
    const verified = await this.verification.execute({
      target,
      access: { transport: target.transport, endpoint: created.endpoint },
      identity: identity ? { store: identity.store, name: identity.name } : undefined,
      runtime: request.runtime,
      store: request.store,
      runId: created.runId,
    });

    return { ...created, requirementRun: verified.requirementRun };
  }
}
