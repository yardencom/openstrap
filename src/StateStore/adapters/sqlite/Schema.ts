/** The state store holds what is true of this machine only. */
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

  /** The image a target was made from: the file, not the name that was asked for. */
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




  `CREATE TABLE IF NOT EXISTS fact_snapshot (
     id             TEXT PRIMARY KEY,
     target         TEXT NOT NULL REFERENCES target(name) ON DELETE CASCADE,
     run_id         TEXT,
     schema_version TEXT NOT NULL,
     captured_at    TEXT NOT NULL,
     data           TEXT NOT NULL
   )`,

  /** The image one run actually used. */
  `CREATE TABLE IF NOT EXISTS run_image (
     run_id       TEXT PRIMARY KEY REFERENCES run(id) ON DELETE CASCADE,
     reference    TEXT NOT NULL,
     url          TEXT NOT NULL,
     sha256       TEXT NOT NULL
   )`,

  /** How a machine measured up against what was required of it, so the verdict can travel too. */
  `CREATE TABLE IF NOT EXISTS requirement_run (
     id           TEXT PRIMARY KEY,
     target       TEXT NOT NULL REFERENCES target(name) ON DELETE CASCADE,
     run_id       TEXT REFERENCES run(id) ON DELETE CASCADE,
     status       TEXT NOT NULL,
     evaluated_at TEXT NOT NULL,
     results      TEXT NOT NULL
   )`,

  /**
   * A run that has reached a server, and what it is called there.
   *
   * A run made on this machine with no server to tell is still something that happened, and when a
   * server appears it has to hear about it. A row here means it already has: the server gave the run
   * an id of its own, so this is both the mark that it went and the way back to it.
   *
   * A table rather than a column on `run`, because a local store made before this existed has no such
   * column and nothing here migrates one in.
   */
  `CREATE TABLE IF NOT EXISTS carried_run (
     run_id     TEXT PRIMARY KEY REFERENCES run(id) ON DELETE CASCADE,
     server_run TEXT NOT NULL,
     carried_at TEXT NOT NULL
   )`,

  "CREATE INDEX IF NOT EXISTS run_by_target ON run(target, started_at)",
  "CREATE INDEX IF NOT EXISTS fact_snapshot_by_target ON fact_snapshot(target, captured_at)",
] as const;
