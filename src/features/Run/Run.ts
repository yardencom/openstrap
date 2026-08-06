import type { Blueprint, BlueprintTarget } from "../../Modules/Blueprint/index.js";
import type { FactSnapshot } from "#types/FactSnapshot.js";
import type { OpenStrapRuntime } from "../../Plugin/index.js";
import {
  mergeRequirementRuns,
  Requirements,
  runSucceeded,
  type RequirementRun,
  type TargetlessRequirement,
} from "../../Modules/Requirements/index.js";
import type { SqliteStateStore } from "../../StateStore/index.js";
import type { Target } from "#types/Target.js";
import { Converge } from "../Converge/Converge.js";
import { Create } from "../Create/Create.js";
import { Facts } from "../../Modules/Facts/Facts.js";

export type RunRequest = {
  blueprint: Blueprint;
  runtime: OpenStrapRuntime;
  store: SqliteStateStore;
  workspaceRoot?: string;
  hostPort: number;
  now?: Date;
};

export type RunResult = {
  snapshots: readonly FactSnapshot[];
  requirementRun: RequirementRun;
};

/**
 * `run` — take a blueprint from what it declares to what is true, target by target.
 *
 * A target that names a provider is a machine openstrap makes: it is created, started, delivered
 * openstrap, read there, and judged — the whole of `create`, which is why this asks that feature
 * rather than repeating it. A target with no provider is the machine openstrap is already on, and is
 * read here.
 *
 * That distinction is the point of this feature existing. A run used to read the host for every
 * target a blueprint declared, whatever the target was, and name the reading after it: a snapshot
 * labelled `guest`/`vm` holding a MacBook's facts, with `ssh-running` passing against the wrong
 * machine. Which machine a fact is about cannot be a label put on afterwards.
 *
 * What is written down is written by whoever knows: `create` records the target, the image, the
 * reserved port, the run and its steps, and the snapshot it took, and reads the machine's key from
 * the secret store to get there. A host reading has none of that — no provider, no channel, no
 * identity — so what it leaves behind is the snapshot itself.
 *
 * Then, where the machine fell short of what was declared and the blueprint says how to reach it, it
 * is reached. That is what makes this the whole cycle rather than three quarters of it: declaring,
 * reading and comparing end in a verdict, and a verdict is not a machine that works. `converge` is
 * asked for it — the same feature the command of that name asks — so there is one loop, one way of
 * getting to a machine that is not this one, and one place that decides where the acting happens.
 */
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

    return { snapshots, requirementRun: mergeRequirementRuns(runs) };
  }

  /**
   * The machine brought to what was declared, where it was not and something knows how.
   *
   * Not attempted when the verdict already passed: there is nothing to make true, and for a machine
   * openstrap is not on it would be a delivery and a reading that change nothing. Not attempted when
   * the target declares no step either — nothing would be planned, and the answer would be the
   * verdict that is already in hand with one wasted reading in front of it. This is the line that
   * widens the day a plugin can offer steps of its own: then a target with none written in it may
   * still have somebody who knows.
   *
   * What comes back replaces the reading and the verdict, because it is later than both. Converging
   * ends by reading the machine afresh and judging it, which is the same question `create` answered a
   * moment ago against a machine that has since been worked on.
   */
  private async reached(
    target: BlueprintTarget,
    read: { snapshot?: FactSnapshot; requirementRun: RequirementRun },
    request: RunRequest,
  ): Promise<{ snapshot?: FactSnapshot; requirementRun: RequirementRun }> {
    if (runSucceeded(read.requirementRun.status) || !target.steps || target.steps.length === 0) {
      return read;
    }

    return this.converge.execute({
      target,
      runtime: request.runtime,
      store: request.store,
      now: request.now,
    });
  }

  /**
   * A machine openstrap makes, brought up and read where it is.
   *
   * `create` is asked for the whole of it rather than for its parts: a machine that exists is
   * adopted rather than made twice, and what comes back is what the machine turned out to be.
   */
  private async machine(
    target: BlueprintTarget,
    request: RunRequest,
  ): Promise<{ snapshot?: FactSnapshot; requirementRun: RequirementRun }> {
    const created = await this.create.execute({
      target,
      runtime: request.runtime,
      store: request.store,
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

  /**
   * The machine openstrap is on, read here and remembered.
   *
   * The target is recorded before the reading is: a snapshot belongs to a machine, and the store
   * says so with a foreign key. `create` writes that row for machines it makes, and a host target is
   * never created — so a run declaring one is the only thing that can write it down.
   */
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

    request.store.saveTarget({ ...machine, transport: target.transport }, at);
    request.store.saveDesiredState(target.name, target, at);
    request.store.saveFactSnapshot({
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
