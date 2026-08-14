import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/**
 * What is true of this machine only.
 *
 * The one description of these tables. Queries are written against it, and the statements that bring
 * a database up to it are generated from it by `npm run schema:migrations` — never written by hand,
 * because a hand-written idempotent create silently does nothing when what changed is a column, and
 * the database on somebody's disk quietly stays as it was.
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
  /** Absent where the publisher published none. */
  sha256: text("sha256"),
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
  sha256: text("sha256"),
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
