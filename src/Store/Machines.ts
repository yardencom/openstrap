import { desc, eq, max } from "drizzle-orm";

import { desiredState, machineImage, target } from "./Schema.js";
import type { Database } from "./Database.js";
import type { MachineImageRecord, TargetRecord } from "./types/Records.js";

/**
 * What a machine was declared to be, and what it was made from.
 *
 * Not what it is: that is read from the machine, or asked of the provider holding it. Everything here
 * was written by openstrap at the moment it acted, and is worth keeping only because nothing else
 * can answer it afterwards — a blueprint changes, and the file a name resolved to has moved on.
 */
export class Machines {
  constructor(private readonly database: Database) {}

  /** Recording a machine twice updates it rather than creating a second one. */
  save(machine: TargetRecord, now: string): void {
    this.database.insert(target).values({
      name: machine.name,
      scope: machine.scope,
      type: machine.type,
      provider: machine.provider ?? null,
      transport: machine.transport ?? "",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: target.name,
      set: {
        scope: machine.scope,
        type: machine.type,
        provider: machine.provider ?? null,
        transport: machine.transport ?? "",
        updatedAt: now,
      },
    }).run();
  }

  read(name: string): TargetRecord | null {
    const row = this.database.select().from(target).where(eq(target.name, name)).get();

    return row === undefined ? null : Machines.recordOf(row);
  }

  list(): TargetRecord[] {
    return this.database.select().from(target).orderBy(target.name).all().map(Machines.recordOf);
  }

  /** Each recorded declaration becomes the next revision of what this machine is meant to be. */
  declare(machine: string, declaration: unknown, now: string): number {
    const previous = this.database
      .select({ revision: max(desiredState.revision) })
      .from(desiredState)
      .where(eq(desiredState.target, machine))
      .get();
    const revision = (previous?.revision ?? 0) + 1;

    this.database.insert(desiredState).values({
      target: machine,
      revision,
      declaration: JSON.stringify(declaration),
      createdAt: now,
    }).run();

    return revision;
  }

  declaration(machine: string): { revision: number; declaration: unknown } | null {
    const row = this.database
      .select()
      .from(desiredState)
      .where(eq(desiredState.target, machine))
      .orderBy(desc(desiredState.revision))
      .get();

    return row === undefined ? null : { revision: row.revision, declaration: JSON.parse(row.declaration) };
  }

  /** The file this machine is made from, and stays made from until somebody says otherwise. */
  pin(machine: string, image: MachineImageRecord, now: string): void {
    this.database.insert(machineImage).values({ target: machine, ...image, createdAt: now })
      .onConflictDoUpdate({ target: machineImage.target, set: { ...image, createdAt: now } })
      .run();
  }

  pinOf(machine: string): MachineImageRecord | null {
    const row = this.database.select().from(machineImage).where(eq(machineImage.target, machine)).get();

    return row === undefined ? null : {
      reference: row.reference,
      url: row.url,
      sha256: row.sha256 ?? undefined,
      platform: row.platform,
      architecture: row.architecture,
      format: row.format,
      boot: row.boot,
    };
  }

  private static recordOf(row: typeof target.$inferSelect): TargetRecord {
    return {
      name: row.name,
      // Written from a blueprint already checked against these words, so read back as stored rather
      // than checked again against the same list.
      scope: row.scope as TargetRecord["scope"],
      type: row.type as TargetRecord["type"],
      provider: row.provider ?? undefined,
      transport: row.transport === "" ? undefined : row.transport,
    };
  }
}
