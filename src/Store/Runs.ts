import { desc, eq } from "drizzle-orm";

import { factSnapshot, requirementRun, run, runImage, runStep } from "./Schema.js";
import type { Database } from "./Database.js";
import type {
  FactSnapshotRecord,
  RequirementRunRecord,
  RunImageRecord,
  RunRecord,
  RunStepRecord,
} from "./types/Records.js";

/**
 * What happened to a machine, and what it was found to be while it happened.
 *
 * openstrap reads none of this back to decide anything — a run is journal, for a person or for a
 * server that was not listening at the time. Which is why it is kept whole: steps as steps, the
 * reading as a reading, the verdict as a verdict, rather than as a sentence that says all three.
 */
export class Runs {
  constructor(private readonly database: Database) {}

  start(opened: Omit<RunRecord, "status" | "finishedAt">): void {
    this.database.insert(run).values({ ...opened, status: "running" }).run();
  }

  finish(id: string, status: Exclude<RunRecord["status"], "running">, finishedAt: string): void {
    this.database.update(run).set({ status, finishedAt }).where(eq(run.id, id)).run();
  }

  read(id: string): RunRecord | null {
    const row = this.database.select().from(run).where(eq(run.id, id)).get();

    return row === undefined ? null : Runs.recordOf(row);
  }

  of(machine: string): RunRecord[] {
    return this.database
      .select()
      .from(run)
      .where(eq(run.target, machine))
      .orderBy(desc(run.startedAt), desc(run.id))
      .all()
      .map(Runs.recordOf);
  }

  /** A step recorded twice is the same step further along, not a second one. */
  recordStep(step: RunStepRecord): void {
    this.database.insert(runStep).values({
      runId: step.runId,
      ordinal: step.ordinal,
      name: step.name,
      status: step.status,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt ?? null,
      detail: step.detail ?? null,
    }).onConflictDoUpdate({
      target: [runStep.runId, runStep.ordinal],
      set: { status: step.status, finishedAt: step.finishedAt ?? null, detail: step.detail ?? null },
    }).run();
  }

  steps(runId: string): RunStepRecord[] {
    return this.database
      .select()
      .from(runStep)
      .where(eq(runStep.runId, runId))
      .orderBy(runStep.ordinal)
      .all()
      .map((row) => ({
        runId: row.runId,
        ordinal: row.ordinal,
        name: row.name,
        status: row.status as RunStepRecord["status"],
        startedAt: row.startedAt,
        finishedAt: row.finishedAt ?? undefined,
        detail: row.detail ?? undefined,
      }));
  }

  /** Which file this run built with. The step says it as a sentence; this says it as data. */
  recordImage(runId: string, image: RunImageRecord): void {
    this.database.insert(runImage).values({ runId, ...image })
      .onConflictDoUpdate({ target: runImage.runId, set: image })
      .run();
  }

  imageOf(runId: string): RunImageRecord | null {
    const row = this.database.select().from(runImage).where(eq(runImage.runId, runId)).get();

    return row === undefined ? null : { reference: row.reference, url: row.url, sha256: row.sha256 };
  }

  recordSnapshot(snapshot: FactSnapshotRecord): void {
    this.database.insert(factSnapshot).values({
      id: snapshot.id,
      target: snapshot.target,
      runId: snapshot.runId ?? null,
      schemaVersion: snapshot.schemaVersion,
      capturedAt: snapshot.capturedAt,
      data: JSON.stringify(snapshot.data),
    }).onConflictDoNothing().run();
  }

  latestSnapshotOf(machine: string): FactSnapshotRecord | null {
    const row = this.database
      .select()
      .from(factSnapshot)
      .where(eq(factSnapshot.target, machine))
      .orderBy(desc(factSnapshot.capturedAt), desc(factSnapshot.id))
      .get();

    return row === undefined ? null : Runs.snapshotOf(row);
  }

  snapshotFrom(runId: string): FactSnapshotRecord | undefined {
    const row = this.database
      .select()
      .from(factSnapshot)
      .where(eq(factSnapshot.runId, runId))
      .orderBy(desc(factSnapshot.capturedAt))
      .get();

    return row === undefined ? undefined : Runs.snapshotOf(row);
  }

  /** How the machine measured up, so a verdict reached where nobody was listening can still travel. */
  recordVerdict(verdict: RequirementRunRecord): void {
    this.database.insert(requirementRun).values({
      id: verdict.id,
      target: verdict.target,
      runId: verdict.runId ?? null,
      status: verdict.status,
      evaluatedAt: verdict.evaluatedAt,
      results: JSON.stringify(verdict.results),
    }).onConflictDoUpdate({
      target: requirementRun.id,
      set: { status: verdict.status, results: JSON.stringify(verdict.results) },
    }).run();
  }

  verdictFrom(runId: string): RequirementRunRecord | undefined {
    const row = this.database.select().from(requirementRun).where(eq(requirementRun.runId, runId)).get();

    return row === undefined ? undefined : {
      id: row.id,
      target: row.target,
      runId: row.runId ?? undefined,
      status: row.status,
      evaluatedAt: row.evaluatedAt,
      results: JSON.parse(row.results),
    };
  }

  private static recordOf(row: typeof run.$inferSelect): RunRecord {
    return {
      id: row.id,
      target: row.target,
      command: row.command,
      status: row.status as RunRecord["status"],
      startedAt: row.startedAt,
      finishedAt: row.finishedAt ?? undefined,
    };
  }

  private static snapshotOf(row: typeof factSnapshot.$inferSelect): FactSnapshotRecord {
    return {
      id: row.id,
      target: row.target,
      runId: row.runId ?? undefined,
      schemaVersion: row.schemaVersion,
      capturedAt: row.capturedAt,
      data: JSON.parse(row.data),
    };
  }
}
