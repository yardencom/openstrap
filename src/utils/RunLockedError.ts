import type { RunLockHolder } from "./RunLockHolder.js";

export class RunLockedError extends Error {
  constructor(readonly holder: RunLockHolder) {
    super(`Already running: ${holder.operation} started at ${holder.startedAt} by process ${holder.pid}`);
    this.name = "RunLockedError";
  }
}
