import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { Action, FileAccess } from "#types/Action.js";
import type { Step, StepOutcome } from "#types/Step.js";

const run = promisify(execFile);

/** What each word for access means as a mode, and the whole of what openstrap will set. */
const modes: Record<FileAccess, number> = {
  executable: 0o755,
  private: 0o600,
  readable: 0o644,
};

/**
 * Doing what the plan says, on the machine the plan is about.
 *
 * Through the machine's own APIs and never through a channel, for the same reason facts are
 * collected that way: a machine acted on from outside and a machine acted on from inside would be
 * two implementations of the same thing, and they would drift. openstrap goes to the machine and
 * runs there. Getting it there is delivery, and delivery is somebody else's module.
 *
 * A step that fails does not stop the pass. In a loop with no dependency graph, a step failing
 * because its turn has not come is the ordinary case — a manifest applied to a cluster that is still
 * starting — and the pass after this one reads the machine again and finds out whether it matters.
 * Stopping at the first failure would turn "not yet" into "no".
 *
 * Nothing here knows what any step is for. It is a switch over four kinds and it will stay one:
 * every word about packages, services and distributions belongs to whoever wrote the step.
 */
export class Applying {
  async execute(steps: readonly Step[]): Promise<readonly StepOutcome[]> {
    const outcomes: StepOutcome[] = [];

    for (const step of steps) {
      outcomes.push(await this.one(step));
    }

    return outcomes;
  }

  private async one(step: Step): Promise<StepOutcome> {
    try {
      await this.act(step.action);

      return { stepId: step.id, status: "done" };
    } catch (error) {
      return { stepId: step.id, status: "failed", message: reason(error) };
    }
  }

  private async act(action: Action): Promise<void> {
    switch (action.kind) {
      case "run":
        await run(action.command, [...action.args], {
          cwd: action.cwd,
          env: action.environment ? { ...process.env, ...action.environment } : process.env,
          timeout: action.timeoutMs ?? 600_000,
          maxBuffer: 8 * 1024 * 1024,
        });

        return;

      case "write":
        await mkdir(dirname(action.path), { recursive: true });
        await writeFile(action.path, action.content, { mode: modes[action.access ?? "readable"] });

        return;

      case "remove":
        await rm(action.path, { force: true, recursive: action.recursive ?? false });

        return;

      case "download":
        await this.fetched(action.url, action.path, action.access);

        return;

      default:
        // Never reached, and that is what it is here to say: adding a kind to the union without
        // adding it here stops compiling.
        return exhausted(action);
    }
  }

  private async fetched(url: string, path: string, access: FileAccess | undefined): Promise<void> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`${url} answered ${response.status}`);
    }

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
    await chmod(path, modes[access ?? "readable"]);
  }
}

function exhausted(action: never): never {
  throw new TypeError(`Not an action: ${JSON.stringify(action)}`);
}

/**
 * Why a step failed, in words.
 *
 * A command that ran and exited non-zero says more in its output than in its message, and the
 * message alone — "Command failed with exit code 1" — is the least useful sentence in computing.
 */
function reason(error: unknown): string {
  if (error && typeof error === "object" && "stderr" in error) {
    const failed = error as { message?: string; stderr?: string; stdout?: string };
    const said = (failed.stderr || failed.stdout || "").trim();

    return said === "" ? failed.message ?? String(error) : `${failed.message ?? ""}: ${said}`.trim();
  }

  return error instanceof Error ? error.message : String(error);
}
