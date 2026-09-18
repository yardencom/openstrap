import { and, asc, inArray, notInArray } from "drizzle-orm";

import { carriedRun, run } from "./Schema.js";
import type { Database } from "./Database.js";
import type { Machines } from "./Machines.js";
import type { Runs } from "./Runs.js";
import type { CarriedRunCandidate } from "./types/Records.js";

/**
 * Which runs a server has already been told about, and which are still waiting.
 *
 * The mark is the id the server gave the run, so this is both "it went" and the way back to it. It
 * asks the other two for what a waiting run consists of rather than reaching into their tables: a run
 * is told whole — what the machine was declared to be, what it was made from, what happened, what it
 * was found to be — and those are their answers to give.
 */
export class Carried {
  constructor(
    private readonly database: Database,
    private readonly machines: Machines,
    private readonly runs: Runs,
  ) {}

  /** Finished runs no server has heard of, oldest first, each with everything needed to tell it. */
  waiting(): CarriedRunCandidate[] {
    const alreadyTold = this.database.select({ runId: carriedRun.runId }).from(carriedRun);

    return this.database
      .select()
      .from(run)
      .where(and(
        // Finished only: a run still going is one this process is in the middle of, or one a crash
        // left behind, and neither is an outcome to report.
        inArray(run.status, ["succeeded", "failed"]),
        notInArray(run.id, alreadyTold),
      ))
      .orderBy(asc(run.startedAt), asc(run.id))
      .all()
      .map((row) => ({
        id: row.id,
        target: row.target,
        command: row.command,
        status: row.status as "succeeded" | "failed",
        startedAt: row.startedAt,
        finishedAt: row.finishedAt ?? undefined,
        declaration: this.machines.declaration(row.target)?.declaration,
        recorded: this.machines.read(row.target) ?? undefined,
        image: this.machines.pinOf(row.target) ?? undefined,
        builtWith: this.runs.imageOf(row.id) ?? undefined,
        steps: this.runs.steps(row.id),
        snapshot: this.runs.snapshotFrom(row.id),
        requirementRun: this.runs.verdictFrom(row.id),
      }));
  }

  /** This run has been told to a server, and there it is called this. */
  mark(runId: string, serverRunId: string, at: string): void {
    this.database.insert(carriedRun).values({ runId, serverRun: serverRunId, carriedAt: at })
      .onConflictDoNothing()
      .run();
  }
}
