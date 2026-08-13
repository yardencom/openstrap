import type { Blueprint, BlueprintTarget } from "../../Modules/Blueprint/index.js";
import type { FactSnapshot } from "#types/FactSnapshot.js";
import type { OpenStrapRuntime } from "../../Plugin/index.js";
import {
  MergeRequirementRuns,
  Requirements,
  Checks,
  type RequirementRun,
  type TargetlessRequirement,
} from "../../Modules/Requirements/index.js";
import type { OpenStrapServer } from "../../Api/index.js";
import type { Store } from "../../Store/index.js";
import type { Target } from "#types/Target.js";
import { Converge } from "../Converge/Converge.js";
import { Create } from "../Create/Create.js";
import { Facts } from "../../Modules/Facts/Facts.js";

export type RunRequest = {
  blueprint: Blueprint;
  runtime: OpenStrapRuntime;
  /** This machine's own record, which is where a machine lives when a run has no server. */
  store?: Store;
  /** The record a team shares. Where there is one it decides, and the store is not written. */
  server?: OpenStrapServer;
  workspaceRoot?: string;
  hostPort: number;
  now?: Date;
};

export type RunResult = {
  snapshots: readonly FactSnapshot[];
  requirementRun: RequirementRun;
};

/** `run` — take a blueprint from what it declares to what is true, target by target. */
export class Run {
  constructor(
    private readonly create = new Create(),
    private readonly converge = new Converge(),
  ) {}

  async execute(request: RunRequest): Promise<RunResult> {
    const snapshots: FactSnapshot[] = [];
    const runs: RequirementRun[] = [];

    for (const target of Object.values(request.blueprint.targets)) {
      const read = target.provider === undefined
        ? await this.host(target, request)
        : await this.machine(target, request);
      const reading = await this.reached(target, read, request);

      if (reading.snapshot !== undefined) {
        snapshots.push(reading.snapshot);
      }

      runs.push(reading.requirementRun);
    }

    return { snapshots, requirementRun: MergeRequirementRuns.of(runs) };
  }

  /** The machine brought to what was declared, where it was not and something knows how. */
  private async reached(
    target: BlueprintTarget,
    read: { snapshot?: FactSnapshot; requirementRun: RequirementRun },
    request: RunRequest,
  ): Promise<{ snapshot?: FactSnapshot; requirementRun: RequirementRun }> {
    if (Checks.succeeded(read.requirementRun.status) || !target.steps || target.steps.length === 0) {
      return read;
    }

    return this.converge.execute({
      target,
      runtime: request.runtime,
      store: request.store,
      server: request.server,
      now: request.now,
    });
  }

  /** A machine openstrap makes, brought up and read where it is. */
  private async machine(
    target: BlueprintTarget,
    request: RunRequest,
  ): Promise<{ snapshot?: FactSnapshot; requirementRun: RequirementRun }> {
    const created = await this.create.execute({
      target,
      runtime: request.runtime,
      store: request.store,
      server: request.server,
      hostPort: request.hostPort,
      now: request.now,
    });

    // Nothing was required of it, so nothing was read there and there is no snapshot to report. The
    // machine is up, which is the whole of what was asked. Reading the host instead and calling it
    // this machine is the mistake this feature exists to end.
    return created.requirementRun === undefined
      ? { requirementRun: this.judge(created.machine, target.requirements, [], request) }
      : { snapshot: created.snapshot, requirementRun: created.requirementRun };
  }

  /** The machine openstrap is on, read here and remembered. */
  private async host(
    target: BlueprintTarget,
    request: RunRequest,
  ): Promise<{ snapshot: FactSnapshot; requirementRun: RequirementRun }> {
    // A target with no provider is this machine, and that is the whole of what `host` means: nobody
    // made it and nothing was reached to get to it. There is no provider here to say otherwise.
    const machine: Target = {
      name: target.name,
      scope: "host",
      type: "host",
      displayName: target.displayName,
    };
    const snapshot = await this.read(machine, target.requirements, request);
    const at = String(snapshot.reading.takenAt);

    // Only where this machine keeps its own record. A run against the host makes nothing and reaches
    // nothing, so there is no run to open on a server and nothing there to tell about it.
    request.store?.machines.save({ ...machine, transport: target.transport }, at);
    request.store?.machines.declare(target.name, target, at);
    request.store?.runs.recordSnapshot({
      id: String(snapshot.id),
      target: target.name,
      schemaVersion: snapshot.schemaVersion,
      capturedAt: at,
      data: { ...snapshot.facts },
    });

    return { snapshot, requirementRun: this.judge(machine, target.requirements, [snapshot], request) };
  }

  private read(
    machine: Target,
    requirements: readonly TargetlessRequirement[],
    request: RunRequest,
  ): Promise<FactSnapshot> {
    return Facts.collect({
      target: machine,
      declare: new Requirements(requirements).order(),
      now: request.now,
    });
  }

  private judge(
    machine: Target,
    requirements: readonly TargetlessRequirement[],
    snapshots: readonly FactSnapshot[],
    request: RunRequest,
  ): RequirementRun {
    return new Requirements(requirements).checkedAgainst({
      target: machine,
      snapshots,
      now: request.now,
      trigger: "manual",
      profile: "local-run",
      purpose: "preflight",
    });
  }
}
