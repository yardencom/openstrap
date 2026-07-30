import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  MachineImageRecord,
  AllocatedPortRecord,
  FactSnapshotRecord,
  ProviderResourceRecord,
  RunImageRecord,
  RunRecord,
  RunStepRecord,
  SecretReferenceRecord,
  TargetRecord,
} from "../../types/StateRecords.js";
import { stateStoreSchema } from "./Schema.js";

export class SqliteStateStore {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA foreign_keys = ON");

    for (const statement of stateStoreSchema) {
      this.database.exec(statement);
    }
  }

  close(): void {
    this.database.close();
  }

  /** Recording a target twice updates it rather than creating a second one. */
  saveTarget(target: TargetRecord, now: string): void {
    this.database.prepare(`
      INSERT INTO target (name, scope, type, provider, transport, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        scope = excluded.scope,
        type = excluded.type,
        provider = excluded.provider,
        transport = excluded.transport,
        updated_at = excluded.updated_at
    `).run(target.name, target.scope, target.type, target.provider ?? null, target.transport, now, now);
  }

  readTarget(name: string): TargetRecord | null {
    const row = this.database.prepare(
      "SELECT name, scope, type, provider, transport FROM target WHERE name = ?",
    ).get(name) as Record<string, string | null> | undefined;

    if (!row) {
      return null;
    }

    return {
      name: String(row.name),
      // The row was written from a blueprint that had already been validated against these words, so
      // it is read back as what was stored rather than checked again against the same list.
      scope: String(row.scope) as TargetRecord["scope"],
      type: String(row.type) as TargetRecord["type"],
      provider: row.provider ?? undefined,
      transport: String(row.transport),
    };
  }

  listTargets(): TargetRecord[] {
    const rows = this.database.prepare(
      "SELECT name, scope, type, provider, transport FROM target ORDER BY name",
    ).all() as Record<string, string | null>[];

    return rows.map((row) => ({
      name: String(row.name),
      // The row was written from a blueprint that had already been validated against these words, so
      // it is read back as what was stored rather than checked again against the same list.
      scope: String(row.scope) as TargetRecord["scope"],
      type: String(row.type) as TargetRecord["type"],
      provider: row.provider ?? undefined,
      transport: String(row.transport),
    }));
  }

  /** Each recorded declaration becomes the next revision of the desired state. */
  saveDesiredState(target: string, declaration: unknown, now: string): number {
    const previous = this.database.prepare(
      "SELECT MAX(revision) AS revision FROM desired_state WHERE target = ?",
    ).get(target) as { revision: number | null } | undefined;
    const revision = (previous?.revision ?? 0) + 1;

    this.database.prepare(
      "INSERT INTO desired_state (target, revision, declaration, created_at) VALUES (?, ?, ?, ?)",
    ).run(target, revision, JSON.stringify(declaration), now);

    return revision;
  }

  readDesiredState(target: string): { revision: number; declaration: unknown } | null {
    const row = this.database.prepare(
      "SELECT revision, declaration FROM desired_state WHERE target = ? ORDER BY revision DESC LIMIT 1",
    ).get(target) as { revision: number; declaration: string } | undefined;

    return row ? { revision: row.revision, declaration: JSON.parse(row.declaration) } : null;
  }

  startRun(run: Omit<RunRecord, "status" | "finishedAt">): void {
    this.database.prepare(
      "INSERT INTO run (id, target, command, status, started_at) VALUES (?, ?, ?, 'running', ?)",
    ).run(run.id, run.target, run.command, run.startedAt);
  }

  finishRun(id: string, status: Exclude<RunRecord["status"], "running">, finishedAt: string): void {
    this.database.prepare("UPDATE run SET status = ?, finished_at = ? WHERE id = ?").run(status, finishedAt, id);
  }

  readRun(id: string): RunRecord | null {
    const row = this.database.prepare(
      "SELECT id, target, command, status, started_at, finished_at FROM run WHERE id = ?",
    ).get(id) as Record<string, string | null> | undefined;

    if (!row) {
      return null;
    }

    return {
      id: String(row.id),
      target: String(row.target),
      command: String(row.command),
      status: String(row.status) as RunRecord["status"],
      startedAt: String(row.started_at),
      finishedAt: row.finished_at ?? undefined,
    };
  }

  listRuns(target: string): RunRecord[] {
    const rows = this.database.prepare(
      "SELECT id, target, command, status, started_at, finished_at FROM run WHERE target = ? ORDER BY started_at DESC, rowid DESC",
    ).all(target) as Record<string, string | null>[];

    return rows.map((row) => ({
      id: String(row.id),
      target: String(row.target),
      command: String(row.command),
      status: String(row.status) as RunRecord["status"],
      startedAt: String(row.started_at),
      finishedAt: row.finished_at ?? undefined,
    }));
  }

  recordStep(step: RunStepRecord): void {
    this.database.prepare(`
      INSERT INTO run_step (run_id, ordinal, name, status, started_at, finished_at, detail)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id, ordinal) DO UPDATE SET
        status = excluded.status,
        finished_at = excluded.finished_at,
        detail = excluded.detail
    `).run(
      step.runId,
      step.ordinal,
      step.name,
      step.status,
      step.startedAt,
      step.finishedAt ?? null,
      step.detail ?? null,
    );
  }

  listSteps(runId: string): RunStepRecord[] {
    const rows = this.database.prepare(
      "SELECT run_id, ordinal, name, status, started_at, finished_at, detail FROM run_step WHERE run_id = ? ORDER BY ordinal",
    ).all(runId) as Record<string, string | number | null>[];

    return rows.map((row) => ({
      runId: String(row.run_id),
      ordinal: Number(row.ordinal),
      name: String(row.name),
      status: String(row.status) as RunStepRecord["status"],
      startedAt: String(row.started_at),
      finishedAt: row.finished_at === null ? undefined : String(row.finished_at),
      detail: row.detail === null ? undefined : String(row.detail),
    }));
  }

  saveProviderResource(resource: ProviderResourceRecord, now: string): void {
    this.database.prepare(`
      INSERT INTO provider_resource (target, provider, resource_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(target) DO UPDATE SET
        provider = excluded.provider,
        resource_id = excluded.resource_id
    `).run(resource.target, resource.provider, resource.resourceId, now);
  }

  readProviderResource(target: string): ProviderResourceRecord | null {
    const row = this.database.prepare(
      "SELECT target, provider, resource_id FROM provider_resource WHERE target = ?",
    ).get(target) as Record<string, string> | undefined;

    return row
      ? { target: String(row.target), provider: String(row.provider), resourceId: String(row.resource_id) }
      : null;
  }

  /**
   * Reserves a host port, refusing one already held by another target.
   *
   * The refusal is the point: two machines must never be handed the same port.
   */
  allocatePort(port: AllocatedPortRecord, now: string): void {
    const existing = this.database.prepare(
      "SELECT target FROM allocated_port WHERE host_port = ?",
    ).get(port.hostPort) as { target: string } | undefined;

    if (existing && existing.target !== port.target) {
      throw new Error(`Host port ${port.hostPort} is already reserved for target "${existing.target}"`);
    }

    this.database.prepare(`
      INSERT INTO allocated_port (host_port, target, guest_port, protocol, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(host_port) DO UPDATE SET
        guest_port = excluded.guest_port,
        protocol = excluded.protocol
    `).run(port.hostPort, port.target, port.guestPort, port.protocol, now);
  }

  releasePorts(target: string): void {
    this.database.prepare("DELETE FROM allocated_port WHERE target = ?").run(target);
  }

  listAllocatedPorts(): AllocatedPortRecord[] {
    const rows = this.database.prepare(
      "SELECT host_port, target, guest_port, protocol FROM allocated_port ORDER BY host_port",
    ).all() as Record<string, string | number>[];

    return rows.map((row) => ({
      hostPort: Number(row.host_port),
      target: String(row.target),
      guestPort: Number(row.guest_port),
      protocol: String(row.protocol),
    }));
  }

  saveSecretReference(reference: SecretReferenceRecord, now: string): void {
    this.database.prepare(`
      INSERT INTO secret_reference (target, purpose, store, name, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(target, purpose) DO UPDATE SET
        store = excluded.store,
        name = excluded.name
    `).run(reference.target, reference.purpose, reference.store, reference.name, now);
  }

  /**
   * Records the image a target was made from. Replacing it is what `create --repin` asks for.
   */
  saveMachineImage(target: string, image: MachineImageRecord, now: string): void {
    this.database.prepare(`
      INSERT INTO machine_image (target, reference, url, sha256, platform, architecture, format, boot, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(target) DO UPDATE SET
        reference = excluded.reference, url = excluded.url, sha256 = excluded.sha256,
        platform = excluded.platform, architecture = excluded.architecture,
        format = excluded.format, boot = excluded.boot, created_at = excluded.created_at
    `).run(
      target, image.reference, image.url, image.sha256,
      image.platform, image.architecture, image.format, image.boot, now,
    );
  }

  readMachineImage(target: string): MachineImageRecord | null {
    const row = this.database.prepare(`
      SELECT reference, url, sha256, platform, architecture, format, boot FROM machine_image WHERE target = ?
    `).get(target) as Record<string, string> | undefined;

    return row
      ? {
        reference: String(row.reference),
        url: String(row.url),
        sha256: String(row.sha256),
        platform: String(row.platform),
        architecture: String(row.architecture),
        format: String(row.format),
        boot: String(row.boot),
      }
      : null;
  }

  /** Records which file a run built with, so the history says it in a form that can be compared. */
  recordRunImage(runId: string, image: RunImageRecord): void {
    this.database.prepare(`
      INSERT INTO run_image (run_id, reference, url, sha256) VALUES (?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        reference = excluded.reference, url = excluded.url, sha256 = excluded.sha256
    `).run(runId, image.reference, image.url, image.sha256);
  }

  readRunImage(runId: string): RunImageRecord | null {
    const row = this.database
      .prepare("SELECT reference, url, sha256 FROM run_image WHERE run_id = ?")
      .get(runId) as Record<string, string> | undefined;

    return row
      ? { reference: String(row.reference), url: String(row.url), sha256: String(row.sha256) }
      : null;
  }

  readSecretReference(target: string, purpose: string): SecretReferenceRecord | null {
    const row = this.database.prepare(
      "SELECT target, purpose, store, name FROM secret_reference WHERE target = ? AND purpose = ?",
    ).get(target, purpose) as Record<string, string> | undefined;

    return row
      ? { target: String(row.target), purpose: String(row.purpose), store: String(row.store), name: String(row.name) }
      : null;
  }

  saveFactSnapshot(snapshot: FactSnapshotRecord): void {
    this.database.prepare(`
      INSERT INTO fact_snapshot (id, target, run_id, schema_version, captured_at, data)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        captured_at = excluded.captured_at
    `).run(
      snapshot.id,
      snapshot.target,
      snapshot.runId ?? null,
      snapshot.schemaVersion,
      snapshot.capturedAt,
      JSON.stringify(snapshot.data),
    );
  }

  readLatestFactSnapshot(target: string): FactSnapshotRecord | null {
    const row = this.database.prepare(
      "SELECT id, target, run_id, schema_version, captured_at, data FROM fact_snapshot WHERE target = ? ORDER BY captured_at DESC, rowid DESC LIMIT 1",
    ).get(target) as Record<string, string | null> | undefined;

    if (!row) {
      return null;
    }

    return {
      id: String(row.id),
      target: String(row.target),
      runId: row.run_id ?? undefined,
      schemaVersion: String(row.schema_version),
      capturedAt: String(row.captured_at),
      data: JSON.parse(String(row.data)),
    };
  }

  /** Forgetting a target forgets everything recorded about it. */
  forgetTarget(name: string): void {
    this.database.prepare("DELETE FROM target WHERE name = ?").run(name);
  }
}
