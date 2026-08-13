import { AmbiguousMachineKindError } from "./errors/AmbiguousMachineKindError.js";
import type { BlueprintTarget } from "../../Modules/Blueprint/index.js";
import type { OpenStrapRuntime, Provider } from "../../Plugin/index.js";
import type { FactSnapshot } from "#types/FactSnapshot.js";
import type { RequirementRun } from "../../Modules/Requirements/index.js";
import { FreeHostPort } from "../../utils/FreeHostPort.js";
import { RunLock } from "../../utils/RunLock/RunLock.js";
import { StateHome, type SqliteStateStore } from "../../StateStore/index.js";
import type { Target } from "#types/Target.js";
import { CreateMachine, type CreateMachineResult } from "./application/CreateMachine.js";
import { MissingProviderError } from "./errors/MissingProviderError.js";
import type { OpenStrapServer } from "../../OpenStrapServer/index.js";
import { ReportRun } from "./application/ReportRun.js";
import { VerifyMachine } from "./application/VerifyMachine.js";

export type { CreateMachineResult } from "./application/CreateMachine.js";
export type { CreateStep } from "./application/CreateStep.js";
export { ProviderUnavailableError } from "./errors/ProviderUnavailableError.js";
export { MissingProviderError } from "./errors/MissingProviderError.js";

export type CreateRequest = {
  target: BlueprintTarget;
  runtime: OpenStrapRuntime;
  /** This machine's own record, which is where a machine lives when a run has no server. */
  store?: SqliteStateStore;
  /** The record a team shares. Where there is one it decides, and the store is not written. */
  server?: OpenStrapServer;
  hostPort: number;
  repin?: boolean;
  now?: Date;
};

/** A machine brought into being, and what it turned out to be. */
export type CreateResult = CreateMachineResult & {
  machine: Target;
  requirementRun?: RequirementRun;
  /** What the machine was read to be, when anything was required of it. */
  snapshot?: FactSnapshot;
};

/** `create` — bring a declared target into being, and confirm it is what it promised. */
export class Create {
  constructor(
    private readonly machines = new CreateMachine(),
    private readonly verification = new VerifyMachine(),
    private readonly locks = new RunLock(new StateHome().locks()),
  ) {}

  /** The lock is held here rather than by whoever asks. */
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
      ...Create.machineKind(provider),
      displayName: target.displayName,
    };
    const created = await this.machines.execute({
      target,
      machine,
      provider,
      store: request.store,
      server: request.server,
      // Only where openstrap is not being handed one: a server issues its own and keeps it. The
      // connector makes the key and openstrap sees the half that goes into the machine, nothing more.
      ...(request.server ? {} : { publicKey: await Create.publicKeyFor(target, request) }),
      repin: request.repin,
      // Free on this host right now, asked of the kernel. A server answers with one of its own and
      // its answer wins; without one this is the answer, and nothing writes it down — the provider
      // is the one forwarding it and can be asked again at any time.
      hostPort: request.server ? request.hostPort : await new FreeHostPort().from(request.hostPort),
      now: request.now,
    });

    // Nothing was required of it, so there is nothing to verify: the machine is up, which is all that
    // was asked. The run is still reported — it happened.
    if (target.requirements.length === 0) {
      await this.report(request, created, target.name);

      return { ...created, machine };
    }

    try {
      const verified = await this.verification.execute({
        target,
        machine,
        // As the provider handed it back, unless the blueprint named a channel of its own. What was
        // used here before was the blueprint's `transport` — and when a blueprint said nothing, the
        // word `ssh`, put there by the loader because a provider had been named at all.
        access: created.access,
        privateKey: created.identity.privateKey,
        platform: { platform: created.image.platform, architecture: created.image.architecture },
        runtime: request.runtime,
      });

      await this.report(request, created, target.name, verified);

      return { ...created, machine, requirementRun: verified.requirementRun, snapshot: verified.snapshot };
    } catch (error) {
      await this.report(request, created, target.name, undefined, error);

      throw error;
    }
  }

  /** The run, told to whoever opened it — after the machine has been read, because that is part of it. */
  private report(
    request: CreateRequest,
    created: CreateMachineResult,
    target: string,
    verified?: { snapshot: FactSnapshot; requirementRun: RequirementRun },
    error?: unknown,
  ): Promise<void> {
    return ReportRun.of({
      target,
      runId: created.runId,
      startedAt: created.startedAt,
      steps: created.steps,
      status: error === undefined ? "succeeded" : "failed",
      store: request.store,
      server: request.server,
      ...(verified ? { snapshot: verified.snapshot, requirementRun: verified.requirementRun } : {}),
      ...(error === undefined ? {} : { error }),
    });
  }

  /** The public half to plant, from the connector that will later be the one entering with it. */
  private static async publicKeyFor(target: BlueprintTarget, request: CreateRequest): Promise<string> {
    const connector = request.runtime.transports.require(target.transport ?? "ssh");

    return (await connector.identityFor(target.name)).publicKey;
  }

  /** What kind of machine a provider makes. */
  private static machineKind(provider: Provider): { scope: Target["scope"]; type: Target["type"] } {
    const { scopes, types } = provider.capabilities;

    if (scopes.length !== 1 || types.length !== 1) {
      throw new AmbiguousMachineKindError(provider.id, scopes, types);
    }

    return { scope: scopes[0]!, type: types[0]! };
  }
}
