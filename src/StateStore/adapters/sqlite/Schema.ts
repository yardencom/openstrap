/**
 * The state store holds what is true of this machine only.
 *
 * Allocated ports, provider resource ids, runs, fact snapshots and the image a
 * target was made from are all true of the machine openstrap ran on. The
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
   * The image a target was made from: the file, not the name that was asked for.
   *
   * Two questions are answered by this one row, because they have one answer. `create` asks it
   * before it resolves anything, so the second create of a target is made from the first one's file:
   * `ubuntu:24.04` is a name, and the URL it names serves whatever is current. Delivering openstrap
   * to the machine asks it too — a build for one platform does not run on another, and what the
   * machine is was settled when the image was chosen.
   *
   * `reference` is kept beside the file so a changed blueprint reads as what it is: asking for
   * `ubuntu:26.04` where this says `ubuntu:24.04` is a different intention, not an image that moved.
   *
   * Here rather than derived from the run history, which records the same thing: a journal is
   * something one may delete, and deleting it must not unpin a machine. It belongs to the target and
   * goes when the target goes.
   */
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

  /**
   * The image one run actually used.
   *
   * As data, because the run's steps say it as a sentence for a person to read — with the checksum
   * cut to twelve characters — and a sentence cannot be compared with anything. This is the history:
   * which file each run built with, still true after the target has been repinned or deleted.
   */
  `CREATE TABLE IF NOT EXISTS run_image (
     run_id       TEXT PRIMARY KEY REFERENCES run(id) ON DELETE CASCADE,
     reference    TEXT NOT NULL,
     url          TEXT NOT NULL,
     sha256       TEXT NOT NULL
   )`,

  "CREATE INDEX IF NOT EXISTS run_by_target ON run(target, started_at)",
  "CREATE INDEX IF NOT EXISTS fact_snapshot_by_target ON fact_snapshot(target, captured_at)",
] as const;
