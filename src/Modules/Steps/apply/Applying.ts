import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { Action, FileAccess, StepValue } from "#types/Action.js";
import type { Step, StepOutcome } from "#types/Step.js";

const run = promisify(execFile);

/** Where a value comes from when a step named one instead of writing it. */
export type Reveal = (name: string) => Promise<string | null>;

/** What each word for access means as a mode, and the whole of what openstrap will set. */
const modes: Record<FileAccess, number> = {
  executable: 0o755,
  private: 0o600,
  readable: 0o644,
};

/**
 * Doing what the plan says, on the machine the plan is about.
 *
 * Through the machine's own APIs and never through a channel, for the reason facts are collected that
 * way: a machine acted on from outside and one acted on from inside would be two implementations.
 * A step that fails does not stop the pass — in a loop with no dependency graph, "not yet" is
 * ordinary — and nothing here knows what any step is for.
 */
export class Applying {
  /** @param reveal What answers when a step names a secret rather than writing a value. */
  constructor(private readonly reveal: Reveal = async () => null) {}

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
      return { stepId: step.id, status: "failed", message: Applying.reason(error) };
    }
  }

  private async act(action: Action): Promise<void> {
    switch (action.kind) {
      case "run":
        await run(action.command, [...action.args], {
          cwd: action.cwd,
          env: await this.environment(action.environment),
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
        return Applying.exhausted(action);
    }
  }

  /** What the program is given, with the names a step wrote resolved to values. */
  private async environment(
    declared: Readonly<Record<string, StepValue>> | undefined,
  ): Promise<NodeJS.ProcessEnv> {
    if (declared === undefined) {
      return process.env;
    }

    const given: NodeJS.ProcessEnv = { ...process.env };

    for (const [name, value] of Object.entries(declared)) {
      if (typeof value === "string") {
        given[name] = value;
        continue;
      }

      const revealed = await this.reveal(value.secret);

      if (revealed === null) {
        throw new Error(`no secret called "${value.secret}" was found for ${name}`);
      }

      given[name] = revealed;
    }

    return given;
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

  private static exhausted(action: never): never {
    throw new TypeError(`Not an action: ${JSON.stringify(action)}`);
  }

  /** Why a step failed, in words. */
  private static reason(error: unknown): string {
    if (error && typeof error === "object" && "stderr" in error) {
      const failed = error as { message?: string; stderr?: string; stdout?: string };
      const said = (failed.stderr || failed.stdout || "").trim();

      return said === "" ? failed.message ?? String(error) : `${failed.message ?? ""}: ${said}`.trim();
    }

    return error instanceof Error ? error.message : String(error);
  }
}
