import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Blueprints, type BlueprintTarget } from "../../Modules/Blueprint/index.js";
import { CreateMachine, VerifyMachine, type CreateMachineResult } from "../../Create/index.js";
import type { RequirementRun } from "../../Modules/Requirements/index.js";
import { LockFile } from "../../LockFile/index.js";
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

export type CreatedTarget = CreateMachineResult & { requirementRun?: RequirementRun };

export async function createTarget(request: CreateCommandRequest): Promise<CreatedTarget> {
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
    const created = await lock.during(request.target, "create", () => new CreateMachine().execute({
      target: target as BlueprintTarget,
      provider,
      store,
      lockFile: new LockFile(join(request.workspaceRoot, "openstrap.lock.yaml")),
      pluginVersions: pluginVersions(request.runtime),
      hostPort: request.hostPort ?? 2222,
    }));

    if (target.requirements.length === 0) {
      return created;
    }

    const identity = store.readSecretReference(request.target, "ssh-identity");
    const verified = await new VerifyMachine().execute({
      target: target as BlueprintTarget,
      access: { transport: "ssh", endpoint: created.endpoint },
      identity: identity ? { store: identity.store, name: identity.name } : undefined,
      runtime: request.runtime,
      store,
      runId: created.runId,
    });

    return { ...created, requirementRun: verified.requirementRun };
  } finally {
    store.close();
  }
}

/**
 * Versions of the plugins a run used, for the lock file.
 *
 * They belong there because they are the same for everyone who clones the
 * repository — unlike a reserved port or a provider resource id.
 */
function pluginVersions(runtime: OpenStrapRuntime): Record<string, string> {
  return Object.fromEntries(
    runtime.pluginNames
      .filter((name) => name.startsWith("openstrap:") && name !== "openstrap:core")
      .map((name) => [`@openstrap/${name.slice("openstrap:".length)}`, "0.1.0"]),
  );
}
