import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/**
 * What is true of this machine only.
 *
 * The tables are declared twice and deliberately: once as types, which is what queries are written
 * against, and once as the statements that bring an empty file up to them. Drizzle emits no DDL at
 * run time and its migrator reads files from disk, which a single executable has none of (ADR 0001).
 * They sit in one file so a column added to one and not the other is visible in the same screen.
 */
export const target = sqliteTable("target", {
  name: text("name").primaryKey(),
  scope: text("scope").notNull(),
  type: text("type").notNull(),
  provider: text("provider"),
  transport: text("transport").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** The image a target was made from: the file, not the name that was asked for. */
export const machineImage = sqliteTable("machine_image", {
  target: text("target").primaryKey().references(() => target.name, { onDelete: "cascade" }),
  reference: text("reference").notNull(),
  url: text("url").notNull(),
  sha256: text("sha256").notNull(),
  platform: text("platform").notNull(),
  architecture: text("architecture").notNull(),
  format: text("format").notNull(),
  boot: text("boot").notNull(),
  createdAt: text("created_at").notNull(),
});

export const desiredState = sqliteTable("desired_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  target: text("target").notNull().references(() => target.name, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  declaration: text("declaration").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [unique().on(table.target, table.revision)]);

export const run = sqliteTable("run", {
  id: text("id").primaryKey(),
  target: text("target").notNull().references(() => target.name, { onDelete: "cascade" }),
  command: text("command").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
});

export const runStep = sqliteTable("run_step", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id").notNull().references(() => run.id, { onDelete: "cascade" }),
  ordinal: integer("ordinal").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  detail: text("detail"),
}, (table) => [unique().on(table.runId, table.ordinal)]);

/** The image one run actually used, which a repin since then has moved the pin away from. */
export const runImage = sqliteTable("run_image", {
  runId: text("run_id").primaryKey().references(() => run.id, { onDelete: "cascade" }),
  reference: text("reference").notNull(),
  url: text("url").notNull(),
  sha256: text("sha256").notNull(),
});

export const factSnapshot = sqliteTable("fact_snapshot", {
  id: text("id").primaryKey(),
  target: text("target").notNull().references(() => target.name, { onDelete: "cascade" }),
  runId: text("run_id"),
  schemaVersion: text("schema_version").notNull(),
  capturedAt: text("captured_at").notNull(),
  data: text("data").notNull(),
});

/** How a machine measured up against what was required of it. */
export const requirementRun = sqliteTable("requirement_run", {
  id: text("id").primaryKey(),
  target: text("target").notNull().references(() => target.name, { onDelete: "cascade" }),
  runId: text("run_id").references(() => run.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  evaluatedAt: text("evaluated_at").notNull(),
  results: text("results").notNull(),
});

/**
 * A run that has reached a server, and what it is called there.
 *
 * A table rather than a column on `run`, because a store made before this existed has no such column
 * and nothing here migrates one in.
 */
export const carriedRun = sqliteTable("carried_run", {
  runId: text("run_id").primaryKey().references(() => run.id, { onDelete: "cascade" }),
  serverRun: text("server_run").notNull(),
  carriedAt: text("carried_at").notNull(),
});

/** The same tables as statements, because an empty file has to become these before anything reads. */
export const stateStoreSchema = [
  `CREATE TABLE IF NOT EXISTS target (
     name        TEXT PRIMARY KEY,
     scope       TEXT NOT NULL,
     type        TEXT NOT NULL,
     provider    TEXT,
     transport   TEXT NOT NULL,
     created_at  TEXT NOT NULL,
     updated_at  TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS machine_image (
     target       TEXT PRIMARY KEY REFERENCES target(name) ON DELETE CASCADE,
     reference    TEXT NOT NULL,
     url          TEXT NOT NULL,
     sha256       TEXT NOT NULL,
     platform     TEXT NOT NULL,
     architecture TEXT NOT NULL,
     format       TEXT NOT NULL,
     boot         TEXT NOT NULL,
     created_at   TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS desired_state (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     target      TEXT NOT NULL REFERENCES target(name) ON DELETE CASCADE,
     revision    INTEGER NOT NULL,
     declaration TEXT NOT NULL,
     created_at  TEXT NOT NULL,
     UNIQUE (target, revision)
   )`,

  `CREATE TABLE IF NOT EXISTS run (
     id          TEXT PRIMARY KEY,
     target      TEXT NOT NULL REFERENCES target(name) ON DELETE CASCADE,
     command     TEXT NOT NULL,
     status      TEXT NOT NULL,
     started_at  TEXT NOT NULL,
     finished_at TEXT
   )`,

  `CREATE TABLE IF NOT EXISTS run_step (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     run_id      TEXT NOT NULL REFERENCES run(id) ON DELETE CASCADE,
     ordinal     INTEGER NOT NULL,
     name        TEXT NOT NULL,
     status      TEXT NOT NULL,
     started_at  TEXT NOT NULL,
     finished_at TEXT,
     detail      TEXT,
     UNIQUE (run_id, ordinal)
   )`,

  `CREATE TABLE IF NOT EXISTS run_image (
     run_id       TEXT PRIMARY KEY REFERENCES run(id) ON DELETE CASCADE,
     reference    TEXT NOT NULL,
     url          TEXT NOT NULL,
     sha256       TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS fact_snapshot (
     id             TEXT PRIMARY KEY,
     target         TEXT NOT NULL REFERENCES target(name) ON DELETE CASCADE,
     run_id         TEXT,
     schema_version TEXT NOT NULL,
     captured_at    TEXT NOT NULL,
     data           TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS requirement_run (
     id           TEXT PRIMARY KEY,
     target       TEXT NOT NULL REFERENCES target(name) ON DELETE CASCADE,
     run_id       TEXT REFERENCES run(id) ON DELETE CASCADE,
     status       TEXT NOT NULL,
     evaluated_at TEXT NOT NULL,
     results      TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS carried_run (
     run_id     TEXT PRIMARY KEY REFERENCES run(id) ON DELETE CASCADE,
     server_run TEXT NOT NULL,
     carried_at TEXT NOT NULL
   )`,

  "CREATE INDEX IF NOT EXISTS run_by_target ON run(target, started_at)",
  "CREATE INDEX IF NOT EXISTS fact_snapshot_by_target ON fact_snapshot(target, captured_at)",
] as const;
