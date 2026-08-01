import type { Blueprint, BlueprintTarget } from "../../Modules/Blueprint/index.js";
import type { FactSnapshot } from "#types/FactSnapshot.js";
import type { OpenStrapRuntime } from "../../Plugin/index.js";
import {
  mergeRequirementRuns,
  Requirements,
  type RequirementRun,
} from "../../Modules/Requirements/index.js";
import type { SqliteStateStore } from "../../StateStore/index.js";
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
 */
export class Run {
  constructor(private readonly create = new Create()) {}

  async execute(request: RunRequest): Promise<RunResult> {
    const snapshots: FactSnapshot[] = [];
    const runs: RequirementRun[] = [];

    for (const target of Object.values(request.blueprint.targets)) {
      const reading = target.provider === undefined
        ? await this.host(target, request)
        : await this.machine(target, request);

      if (reading.snapshot !== undefined) {
        snapshots.push(reading.snapshot);
      }

      runs.push(reading.requirementRun);
    }

    return { snapshots, requirementRun: mergeRequirementRuns(runs) };
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
      ? { requirementRun: this.judge(target, [], request) }
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
    const snapshot = await this.read(target, request);
    const at = String(snapshot.reading.takenAt);

    request.store.saveTarget({
      name: target.name,
      scope: target.scope,
      type: target.type,
      transport: target.transport,
    }, at);
    request.store.saveDesiredState(target.name, target, at);
    request.store.saveFactSnapshot({
      id: String(snapshot.id),
      target: target.name,
      schemaVersion: snapshot.schemaVersion,
      capturedAt: at,
      data: { ...snapshot.facts },
    });

    return { snapshot, requirementRun: this.judge(target, [snapshot], request) };
  }

  private read(target: BlueprintTarget, request: RunRequest): Promise<FactSnapshot> {
    return Facts.collect({
      target: { name: target.name, scope: target.scope, type: target.type, displayName: target.displayName },
      declare: new Requirements(target.requirements).order(request.workspaceRoot),
      now: request.now,
    });
  }

  private judge(
    target: BlueprintTarget,
    snapshots: readonly FactSnapshot[],
    request: RunRequest,
  ): RequirementRun {
    return new Requirements(target.requirements).checkedAgainst({
      target,
      snapshots,
      now: request.now,
      trigger: "manual",
      profile: "local-run",
      purpose: "preflight",
    });
  }
}
