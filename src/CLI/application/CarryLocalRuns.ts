import type { CarriedRunCandidate, SqliteStateStore } from "../../StateStore/index.js";
import type { DeclaredTarget, OpenStrapServer, ResolvedImage } from "../../OpenStrapServer/index.js";

/**
 * What happened on this machine while no server was listening, told to one that now is.
 *
 * A machine made on a laptop with nothing shared is still a machine the team paid for and will ask
 * about. Nothing new is asked of the server to hear it: the same three calls a run makes as it happens
 * — open it, say what the provider called the machine, say how it went — sent afterwards instead of
 * during. A run has no notion of being replayed, and did not need one.
 *
 * Told oldest first, one at a time, because a second run of the same machine while one is open is a
 * conflict the server is right to refuse. Told once: it comes back with an id of its own, and that id
 * being written down here is what says this run has already gone.
 *
 * A run that will not go through is left alone rather than retried into a loop. It is still here next
 * time, and the reason is worth showing rather than swallowing.
 */
export class CarryLocalRuns {
  constructor(
    private readonly store: SqliteStateStore,
    private readonly server: OpenStrapServer,
    private readonly host: { id: string; platform: string; architecture: string },
    /**
     * What the provider calls a machine, asked now rather than remembered then.
     *
     * Nothing here keeps provider ids: the provider knows its own machines by name. A run whose
     * machine is gone carries without one, which is honest — it happened, and the machine did not last.
     */
    private readonly resourceOf: (provider: string, target: string) => Promise<string | null> = async () => null,
  ) {}

  /** How many went, and what stopped the rest. */
  async all(now = new Date()): Promise<{ carried: number; failures: readonly string[] }> {
    const failures: string[] = [];
    let carried = 0;

    for (const run of this.store.runsToCarry()) {
      const declared = CarryLocalRuns.declaredIn(run);

      // A run whose target was never written down cannot be opened anywhere else: the server is told
      // what a machine is by the blueprint that made it, and this one has no copy of it.
      if (!declared) {
        failures.push(`${run.id}: nothing was recorded about what "${run.target}" is`);
        continue;
      }

      try {
        await this.carry(run, declared, now);
        carried += 1;
      } catch (error) {
        failures.push(`${run.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { carried, failures };
  }

  private async carry(run: CarriedRunCandidate, declared: DeclaredTarget, now: Date): Promise<void> {
    const opened = await this.server.openRun({
      command: run.command === "run" ? "run" : "create",
      host: this.host,
      target: declared,
      ...(run.image ? { proposedImage: CarryLocalRuns.imageOf(run.image) } : {}),
    });

    const provider = declared.provider;
    const resourceId = provider === undefined ? null : await this.resourceOf(provider, declared.name);

    if (provider !== undefined && resourceId !== null) {
      await this.server.recordResource(opened.runId, { provider, resourceId });
    }

    await this.server.finishRun(opened.runId, {
      status: run.status,
      // What this run used, which is not what the server just handed back: a repin since then moved
      // the pin, and the machine this run made was made from the older file.
      ...(run.builtWith ? { image: run.builtWith } : {}),
      steps: run.steps.map((step) => ({
        name: step.name,
        status: step.status,
        startedAt: step.startedAt,
        finishedAt: step.finishedAt ?? step.startedAt,
        ...(step.detail === undefined ? {} : { detail: step.detail }),
      })),
      ...(run.requirementRun ? {
        requirementRun: {
          id: run.requirementRun.id,
          status: run.requirementRun.status,
          evaluatedAt: run.requirementRun.evaluatedAt,
          results: run.requirementRun.results,
        },
      } : {}),
      ...(run.snapshot ? {
        snapshot: {
          id: run.snapshot.id,
          schemaVersion: run.snapshot.schemaVersion,
          capturedAt: run.snapshot.capturedAt,
          facts: run.snapshot.data,
        },
      } : {}),
    });

    this.store.markCarried(run.id, opened.runId, now.toISOString());
  }

  /**
   * The target as the server spells one: the blueprint plus what only the provider knew.
   *
   * A blueprint does not say whether it is describing a vm or a container — the provider that makes
   * it does, and that was written to the `target` row rather than into the declaration. Both halves
   * are needed, and a run missing either cannot be opened anywhere.
   */
  private static declaredIn(run: CarriedRunCandidate): DeclaredTarget | undefined {
    const declared = run.declaration as Record<string, unknown> | undefined;
    const recorded = run.recorded;

    if (!declared || !recorded) {
      return undefined;
    }

    return {
      name: recorded.name,
      scope: recorded.scope,
      type: recorded.type,
      transport: recorded.transport ?? "ssh",
      requirements: Array.isArray(declared.requirements) ? declared.requirements : [],
      ...(typeof declared.displayName === "string" ? { displayName: declared.displayName } : {}),
      ...(recorded.provider === undefined ? {} : { provider: recorded.provider }),
      ...(typeof declared.image === "string" ? { image: declared.image } : {}),
      ...(typeof declared.size === "string" ? { size: declared.size } : {}),
    };
  }

  private static imageOf(image: NonNullable<CarriedRunCandidate["image"]>): ResolvedImage {
    return {
      reference: image.reference,
      url: image.url,
      sha256: image.sha256,
      format: image.format,
      boot: image.boot,
      platform: image.platform,
      architecture: image.architecture,
    };
  }
}
