import { MissingProviderError } from "./MissingProviderError.js";
import { UnknownTargetError } from "./UnknownTargetError.js";
import { join } from "node:path";

import { Blueprints, type BlueprintTarget } from "../../Modules/Blueprint/index.js";
import { CreateMachine, VerifyMachine, type CreateMachineResult } from "../../Create/index.js";
import { LockFile } from "../../LockFile/index.js";
import type { OpenStrapRuntime } from "../../Plugin/index.js";
import { runSucceeded, type RequirementRun } from "../../Modules/Requirements/index.js";
import { RunLock } from "../../utils/RunLock/RunLock.js";
import { SqliteStateStore, StateHome } from "../../StateStore/index.js";
import type { CreateArgs } from "../arguments/types.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";



/**
 * What creating a target produced.
 *
 * The target's name is part of it: anything reading this result needs to know which
 * machine it is about, and asking the caller to remember alongside is how a report ends
 * up naming the wrong one.
 */
export type CreatedTarget = CreateMachineResult & {
  target: string;
  requirementRun?: RequirementRun;
};

/**
 * `openstrap create` — bring a declared target into being and check what it promised.
 *
 * The whole of it runs under a lock named after the target: creating a machine reserves
 * a port and writes provider state, and two runs doing that at once would each believe
 * they owned both.
 */
export class CreateCommand implements CliCommand<CreateArgs, CreatedTarget> {
  constructor(
    private readonly blueprints = new Blueprints(),
    private readonly stateHome = new StateHome(),
  ) {}

  async execute(args: CreateArgs, context: CommandContext): Promise<CommandOutcome<CreatedTarget>> {
    const created = await this.create(args, context);

    return {
      result: created,
      exitCode: runSucceeded(created.requirementRun?.status) ? 0 : 1,
    };
  }

  private async create(args: CreateArgs, context: CommandContext): Promise<CreatedTarget> {
    const blueprint = this.blueprints.load({
      explicitPath: args.configPath,
      workspaceRoot: context.workspaceRoot,
    });
    const target = blueprint.targets[args.target];

    if (!target) {
      throw new UnknownTargetError(args.target, Object.keys(blueprint.targets));
    }

    if (!target.provider) {
      throw new MissingProviderError(args.target);
    }

    const runtime = await context.runtime();
    const provider = runtime.providers.require(target.provider);
    const store = new SqliteStateStore(this.stateHome.database());
    const lock = new RunLock(this.stateHome.locks());

    try {
      const created = await lock.during(args.target, "create", () => new CreateMachine().execute({
        target: target as BlueprintTarget,
        provider,
        store,
        lockFile: new LockFile(join(context.workspaceRoot, "openstrap.lock.yaml")),
        pluginVersions: pluginVersions(runtime),
        hostPort: args.hostPort ?? 2222,
      }));

      // Nothing was required of it, so there is nothing to verify and nothing to
      // report: the machine is up, which is all that was asked.
      if (target.requirements.length === 0) {
        return { ...created, target: args.target };
      }

      const identity = store.readSecretReference(args.target, "ssh-identity");
      const verified = await new VerifyMachine().execute({
        target: target as BlueprintTarget,
        access: { transport: "ssh", endpoint: created.endpoint },
        identity: identity ? { store: identity.store, name: identity.name } : undefined,
        runtime,
        store,
        runId: created.runId,
      });

      return { ...created, target: args.target, requirementRun: verified.requirementRun };
    } finally {
      store.close();
    }
  }
}

/**
 * Versions of the plugins a run used, for the lock file.
 *
 * They belong there because they are the same for everyone who clones the repository —
 * unlike a reserved port or a provider resource id.
 */
function pluginVersions(runtime: OpenStrapRuntime): Record<string, string> {
  return Object.fromEntries(
    runtime.pluginNames
      .filter((name) => name.startsWith("openstrap:"))
      .map((name) => [`@openstrap/${name.slice("openstrap:".length)}`, "0.1.0"]),
  );
}
