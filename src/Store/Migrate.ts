import type { DatabaseSync } from "node:sqlite";

import { migrations, type Migration } from "./Migrations.js";

/**
 * Brings a database up to what the schema says, however far behind it is.
 *
 * Each step runs once and is recorded, so a file made three releases ago gets the three it missed and
 * a file made today gets none. This is what `CREATE TABLE IF NOT EXISTS` could not do: a new table
 * would appear, and a new column on an existing table would silently never arrive.
 *
 * All of it in one transaction, because a database halfway through a step is a database with no name
 * for what it now is.
 */
export class Migrate {
  constructor(private readonly database: DatabaseSync, private readonly steps: readonly Migration[] = migrations) {}

  /** How many steps were applied, which is nought on every run but the ones that matter. */
  apply(): number {
    this.database.exec("CREATE TABLE IF NOT EXISTS schema_migration (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");

    const applied = new Set(
      (this.database.prepare("SELECT name FROM schema_migration").all() as { name: string }[])
        .map((row) => row.name),
    );
    const pending = this.steps
      .filter((step) => !applied.has(step.name))
      .map((step) => (applied.size === 0 ? this.adopted(step) : step));

    if (pending.length === 0) {
      return 0;
    }

    this.database.exec("BEGIN");

    try {
      for (const step of pending) {
        for (const statement of step.statements) {
          this.database.exec(statement);
        }

        this.database.prepare("INSERT INTO schema_migration (name, applied_at) VALUES (?, ?)")
          .run(step.name, new Date().toISOString());
      }

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");

      throw error;
    }

    return pending.length;
  }

  /**
   * A step against a database that already has some of what it creates.
   *
   * openstrap kept a store before it kept migrations: the tables are there and nothing records how
   * they got there, so the first step would try to create what is already in front of it and stop.
   * Only the first step, and only where nothing has been applied yet — after that a `CREATE TABLE`
   * that finds its table already present is a real disagreement and should say so.
   *
   * What such a database has and this schema no longer names — `allocated_port`,
   * `provider_resource`, `secret_reference` — is left alone. Nothing reads it, and dropping a table
   * to tidy up is how somebody's history goes missing.
   */
  private adopted(step: Migration): Migration {
    const existing = new Set(
      (this.database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
        .map((row) => row.name),
    );

    return {
      name: step.name,
      statements: step.statements.filter((statement) => {
        const created = /CREATE TABLE `?(\w+)`?/.exec(statement);

        return created === null || !existing.has(created[1]!);
      }),
    };
  }
}
