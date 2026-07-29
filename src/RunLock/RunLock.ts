import type { RunLockHolder } from "./RunLockHolder.js";
import { RunLockedError } from "./RunLockedError.js";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";



export type RunLockOptions = {
  /** Decides whether the process that took the lock is still alive. */
  processRunning?: (pid: number) => boolean;
};

/**
 * Stops two operations on the same subject from running at once.
 *
 * The lock is a directory, because creating one is atomic on every filesystem that matters — two
 * processes cannot both win, and one of them is told `EEXIST`. Node offers nothing better: there is no
 * lock in its standard library and no `fs.flock`, and the real `flock(2)` comes only through a native
 * addon, which openstrap cannot have — native modules do not survive being packaged into one
 * executable (ADR 0001).
 *
 * `proper-lockfile` is the package everyone reaches for and does the same `mkdir` underneath. It is
 * not used for two reasons. It decides a lock is stale by how fresh the directory's mtime is, kept up
 * to date by a timer, where every lock openstrap takes is held by a process on this same machine — the
 * state home is not shared — so the honest question is whether that process is alive, and the kernel
 * answers it. And it does not record who holds the lock, so it could not say what is already running.
 *
 * A lock left behind by a process that died is not a lock. It is reclaimed, otherwise a single crash
 * makes the subject unusable forever.
 */
export class RunLock {
  private readonly processRunning: (pid: number) => boolean;

  constructor(private readonly directory: string, options: RunLockOptions = {}) {
    this.processRunning = options.processRunning ?? defaultProcessRunning;
  }

  acquire(subject: string, operation: string, now: Date = new Date()): void {
    const path = this.pathFor(subject);

    mkdirSync(dirname(path), { recursive: true });

    if (!this.claim(path)) {
      const holder = this.holderOf(path);

      if (holder && this.processRunning(holder.pid)) {
        throw new RunLockedError(holder);
      }

      rmSync(path, { force: true, recursive: true });

      if (!this.claim(path)) {
        throw new RunLockedError(this.holderOf(path) ?? { pid: 0, operation, startedAt: now.toISOString() });
      }
    }

    writeFileSync(
      join(path, "holder.json"),
      `${JSON.stringify({ pid: process.pid, operation, startedAt: now.toISOString() }, null, 2)}\n`,
      "utf8",
    );
  }

  release(subject: string): void {
    rmSync(this.pathFor(subject), { force: true, recursive: true });
  }

  /** Runs an operation with the lock held, releasing it however the operation ends. */
  async during<TResult>(subject: string, operation: string, work: () => Promise<TResult>): Promise<TResult> {
    this.acquire(subject, operation);

    try {
      return await work();
    } finally {
      this.release(subject);
    }
  }

  private claim(path: string): boolean {
    try {
      mkdirSync(path);
      return true;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        return false;
      }

      throw error;
    }
  }

  private holderOf(path: string): RunLockHolder | null {
    try {
      const holder = JSON.parse(readFileSync(join(path, "holder.json"), "utf8")) as RunLockHolder;

      return typeof holder.pid === "number" ? holder : null;
    } catch {
      return null;
    }
  }

  private pathFor(subject: string): string {
    return join(this.directory, `${subject.replace(/[^a-zA-Z0-9._-]/g, "_")}.lock`);
  }
}

function defaultProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
}
