import { AmbiguousMachineKindError } from "./errors/AmbiguousMachineKindError.js";
import type { BlueprintTarget } from "../../Modules/Blueprint/index.js";
import type { OpenStrapRuntime, Provider } from "../../Plugin/index.js";
import type { FactSnapshot } from "#types/FactSnapshot.js";
import type { RequirementRun } from "../../Modules/Requirements/index.js";
import { RunLock } from "../../utils/RunLock/RunLock.js";
import { StateHome, type SqliteStateStore } from "../../StateStore/index.js";
import type { Target } from "#types/Target.js";
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
  /** Which machine this is, in the words its provider uses. */
  machine: Target;
  requirementRun?: RequirementRun;
  /** What the machine was read to be, when anything was required of it. */
  snapshot?: FactSnapshot;
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
    private readonly locks = new RunLock(new StateHome().locks()),
  ) {}

  /**
   * The lock is held here rather than by whoever asks.
   *
   * Making a machine reserves a host port and writes provider state, and two of these at once would
   * each believe they owned both. It used to be taken by the CLI, which was fine while `create` was
   * the only caller; a run creating every machine a blueprint declares would have gone around it.
   */
  async execute(request: CreateRequest): Promise<CreateResult> {
    const target = request.target;

    if (!target.provider) {
      throw new MissingProviderError(target.name);
    }

    const provider = request.runtime.providers.require(target.provider);

    return this.locks.during(target.name, "create", () => this.make(target, provider, request));
  }

  private async make(
    target: BlueprintTarget,
    provider: Provider,
    request: CreateRequest,
  ): Promise<CreateResult> {
    const machine: Target = {
      name: target.name,
      ...machineKind(provider),
      displayName: target.displayName,
    };
    const created = await this.machines.execute({
      target,
      machine,
      provider,
      store: request.store,
      repin: request.repin,
      hostPort: request.store.hostPortFor(target.name, request.hostPort),
      now: request.now,
    });

    // Nothing was required of it, so there is nothing to verify and nothing to report: the machine is
    // up, which is all that was asked.
    if (target.requirements.length === 0) {
      return { ...created, machine };
    }

    const identity = request.store.readSecretReference(target.name, "ssh-identity");
    const verified = await this.verification.execute({
      target,
      machine,
      // As the provider handed it back, unless the blueprint named a channel of its own. What was
      // used here before was the blueprint's `transport` — and when a blueprint said nothing, the
      // word `ssh`, put there by the loader because a provider had been named at all.
      access: created.access,
      identity: identity ? { store: identity.store, name: identity.name } : undefined,
      runtime: request.runtime,
      store: request.store,
      runId: created.runId,
    });

    return { ...created, machine, requirementRun: verified.requirementRun, snapshot: verified.snapshot };
  }
}

/**
 * What kind of machine a provider makes.
 *
 * Asked of the provider, which declares it: `utm` says it makes a guest and that a guest is a vm.
 * That a blueprint named a provider says only that openstrap is not talking about the machine it
 * runs on — which of the other kinds it is is the provider's to say, and was `guest`/`vm` written
 * out here for as long as there was one provider to be wrong about.
 *
 * A provider that declares several can make several, and nothing so far says which one this is:
 * refused rather than answered with the first of a list.
 */
function machineKind(provider: Provider): { scope: Target["scope"]; type: Target["type"] } {
  const { scopes, types } = provider.capabilities;

  if (scopes.length !== 1 || types.length !== 1) {
    throw new AmbiguousMachineKindError(provider.id, scopes, types);
  }

  return { scope: scopes[0]!, type: types[0]! };
}
