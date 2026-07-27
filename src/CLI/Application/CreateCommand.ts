import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Blueprints, type BlueprintTarget } from "../../Blueprint/index.js";
import { CreateMachine, type CreateMachineResult } from "../../Create/index.js";
import type { OpenStrapRuntime } from "../../Plugin/index.js";
import { RunLock } from "../../RunLock/RunLock.js";
import { SqliteStateStore } from "../../StateStore/index.js";

export type CreateCommandRequest = {
  target: string;
  configPath?: string;
  hostPort?: number;
  runtime: OpenStrapRuntime;
  workspaceRoot: string;
};

export class UnknownTargetError extends Error {
  constructor(name: string, declared: readonly string[]) {
    super(`Target "${name}" is not declared in the blueprint. Declared targets: ${declared.join(", ")}`);
    this.name = "UnknownTargetError";
  }
}

export class MissingProviderError extends Error {
  constructor(name: string) {
    super(`Target "${name}" declares no provider, so there is nothing to create it with`);
    this.name = "MissingProviderError";
  }
}

/**
 * Where openstrap keeps what is true of this machine only.
 */
export function stateHome(): string {
  return process.env.OPENSTRAP_STATE_HOME
    ?? join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"), "openstrap");
}

export async function createTarget(request: CreateCommandRequest): Promise<CreateMachineResult> {
  const blueprint = new Blueprints().load({
    explicitPath: request.configPath,
    workspaceRoot: request.workspaceRoot,
  });
  const target = blueprint.targets[request.target];

  if (!target) {
    throw new UnknownTargetError(request.target, Object.keys(blueprint.targets));
  }

  if (!target.provider) {
    throw new MissingProviderError(request.target);
  }

  const provider = request.runtime.providers.require(target.provider);
  const home = stateHome();
  mkdirSync(home, { recursive: true });

  const store = new SqliteStateStore(join(home, "state.db"));
  const lock = new RunLock(join(home, "locks"));

  try {
    return await lock.during(request.target, "create", () => new CreateMachine().execute({
      target: target as BlueprintTarget,
      provider,
      store,
      hostPort: request.hostPort ?? 2222,
    }));
  } finally {
    store.close();
  }
}
