import { UnknownTargetError } from "../errors/UnknownTargetError.js";

import { Blueprints, type BlueprintTarget } from "../../Modules/Blueprint/index.js";
import { Create, type CreateResult } from "#features/Create/Create.js";
import { Checks } from "../../Modules/Requirements/index.js";
import { SqliteStateStore, StateHome } from "../../StateStore/index.js";
import type { CreateArgs } from "../arguments/types.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";



/** What creating a target produced. The name is part of it, or a report can name the wrong machine. */
export type CreatedTarget = CreateResult & {
  target: string;
};

/** `openstrap create` — bring a declared target into being and check what it promised. */
export class CreateCommand implements CliCommand<CreateArgs, CreatedTarget> {
  constructor(
    private readonly blueprints = new Blueprints(),
    private readonly stateHome = new StateHome(),
  ) {}

  async execute(args: CreateArgs, context: CommandContext): Promise<CommandOutcome<CreatedTarget>> {
    const created = await this.create(args, context);

    return {
      result: created,
      exitCode: Checks.succeeded(created.requirementRun?.status) ? 0 : 1,
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

    const runtime = await context.runtime();
    const store = new SqliteStateStore(this.stateHome.database());

    try {
      const created = await new Create().execute({
        target: target as BlueprintTarget,
        runtime,
        store,
        repin: args.repin,
        hostPort: args.hostPort ?? 2222,
      });

      return { ...created, target: args.target };
    } finally {
      store.close();
    }
  }
}
