/**
 * The state store holds what is true of this machine only.
 *
 * Allocated ports, provider resource ids, runs, fact snapshots and the image a
 * target is pinned to are all true of the machine openstrap ran on. The
 * machine's actual state is not stored — that is read back from the provider,
 * so there is only ever one source of truth for it.
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

  /**
   * The image a target is pinned to.
   *
   * Written the first time a target is created and read before every create after that, so the
   * second run is made from the same file as the first. `ubuntu:24.04` is not a file: the URL it
   * names serves whatever is current, and without a pin a machine recreated a month later is a
   * different machine that answers to the same name.
   *
   * Here rather than in a file in the repository, because a pin is true of this machine: it says
   * what was actually built here, and the next person to clone the repository has built nothing.
   */
  `CREATE TABLE IF NOT EXISTS pinned_image (
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
