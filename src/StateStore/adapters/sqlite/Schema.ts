/**
 * The state store holds what is true of this machine only.
 *
 * Allocated ports, provider resource ids, runs and fact snapshots are correct
 * on one machine and meaningless on another, so they never reach the lock
 * file. The machine's actual state is not stored either — that is read back
 * from the provider, so there is only ever one source of truth for it.
 */
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

  /**
   * What kind of machine a target is, recorded when it was created.
   *
   * openstrap has to know before it can deliver itself there, and a build for one platform does not
   * run on another. It is known at creation — the provider resolved the image — so it is written down
   * then rather than worked out from the machine afterwards.
   */
  `CREATE TABLE IF NOT EXISTS machine_platform (
     target      TEXT PRIMARY KEY REFERENCES target(name) ON DELETE CASCADE,
     platform    TEXT NOT NULL,
     architecture TEXT NOT NULL,
     created_at  TEXT NOT NULL
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

  `CREATE TABLE IF NOT EXISTS provider_resource (
     target      TEXT PRIMARY KEY REFERENCES target(name) ON DELETE CASCADE,
     provider    TEXT NOT NULL,
     resource_id TEXT NOT NULL,
     created_at  TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS allocated_port (
     host_port   INTEGER PRIMARY KEY,
     target      TEXT NOT NULL REFERENCES target(name) ON DELETE CASCADE,
     guest_port  INTEGER NOT NULL,
     protocol    TEXT NOT NULL,
     created_at  TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS secret_reference (
     target      TEXT NOT NULL REFERENCES target(name) ON DELETE CASCADE,
     purpose     TEXT NOT NULL,
     store       TEXT NOT NULL,
     name        TEXT NOT NULL,
     created_at  TEXT NOT NULL,
     PRIMARY KEY (target, purpose)
   )`,

  `CREATE TABLE IF NOT EXISTS fact_snapshot (
     id             TEXT PRIMARY KEY,
     target         TEXT NOT NULL REFERENCES target(name) ON DELETE CASCADE,
     run_id         TEXT,
     schema_version TEXT NOT NULL,
     captured_at    TEXT NOT NULL,
     data           TEXT NOT NULL
   )`,

  "CREATE INDEX IF NOT EXISTS run_by_target ON run(target, started_at)",
  "CREATE INDEX IF NOT EXISTS fact_snapshot_by_target ON fact_snapshot(target, captured_at)",
] as const;
