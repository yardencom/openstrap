import type { CreateStep } from "./CreateStep.js";
import type { FactSnapshot } from "#types/FactSnapshot.js";
import type { OpenStrapServer } from "../../../Server/index.js";
import type { RequirementRun } from "../../../Modules/Requirements/index.js";
import type { SqliteStateStore } from "../../../StateStore/index.js";

export type RunOutcome = {
  target: string;
  runId: string;
  /** When the run began, which is when its first step began. */
  startedAt: string;
  steps: readonly CreateStep[];
  status: "succeeded" | "failed";
  store?: SqliteStateStore;
  server?: OpenStrapServer;
  /** What the machine was read to be, where anything was required of it. */
  snapshot?: FactSnapshot;
  requirementRun?: RequirementRun;
  error?: unknown;
};

/**
 * What happened, told to whoever opened the run.
 *
 * Told once and at the end, because the reading and the verdict are part of what happened: a run
 * reported before the machine was read says a machine was made and not whether it is the machine
 * that was asked for.
 */
export class ReportRun {
  static async of(outcome: RunOutcome): Promise<void> {
    if (outcome.server) {
      await ReportRun.toServer(outcome.server, outcome);

      return;
    }

    ReportRun.toStore(outcome);
  }

  private static async toServer(server: OpenStrapServer, outcome: RunOutcome): Promise<void> {
    await server.finishRun(outcome.runId, {
      status: outcome.status,
      steps: outcome.steps.map((step, index) => ({
        name: step.name,
        status: step.status,
        startedAt: outcome.steps[index - 1]?.finishedAt ?? outcome.startedAt,
        finishedAt: step.finishedAt,
        ...(step.detail === undefined ? {} : { detail: step.detail }),
      })),
      ...(outcome.snapshot === undefined ? {} : {
        snapshot: {
          id: String(outcome.snapshot.id),
          schemaVersion: outcome.snapshot.schemaVersion,
          capturedAt: String(outcome.snapshot.reading.takenAt),
          facts: { ...outcome.snapshot.facts },
        },
      }),
      ...(outcome.requirementRun === undefined ? {} : {
        requirementRun: {
          id: String(outcome.requirementRun.id),
          status: outcome.requirementRun.status,
          evaluatedAt: String(outcome.requirementRun.evaluatedAt),
          results: outcome.requirementRun.results,
        },
      }),
    });
  }

  private static toStore(outcome: RunOutcome): void {
    const store = outcome.store;

    if (!store) {
      return;
    }

    outcome.steps.forEach((step, index) => {
      store.recordStep({
        runId: outcome.runId,
        ordinal: index + 1,
        name: step.name,
        status: step.status === "skipped" ? "skipped" : "succeeded",
        startedAt: outcome.steps[index - 1]?.finishedAt ?? outcome.startedAt,
        finishedAt: step.finishedAt,
        detail: step.detail,
      });
    });

    if (outcome.error !== undefined) {
      store.recordStep({
        runId: outcome.runId,
        ordinal: outcome.steps.length + 1,
        name: "failed",
        status: "failed",
        startedAt: outcome.steps[outcome.steps.length - 1]?.finishedAt ?? outcome.startedAt,
        finishedAt: new Date().toISOString(),
        detail: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
      });
    }

    if (outcome.snapshot !== undefined) {
      store.saveFactSnapshot({
        id: String(outcome.snapshot.id),
        target: outcome.target,
        runId: outcome.runId,
        schemaVersion: outcome.snapshot.schemaVersion,
        capturedAt: String(outcome.snapshot.reading.takenAt),
        data: { ...outcome.snapshot.facts },
      });
    }

    store.finishRun(outcome.runId, outcome.status, new Date().toISOString());
  }
}
