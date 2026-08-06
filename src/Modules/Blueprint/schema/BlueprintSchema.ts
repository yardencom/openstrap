import {
  type ConfigDefinition,
  type ConfigIssue,
  type ConfigSchema,
  type ConfigSchemaNode,
} from "../../../ConfigCore/index.js";
import { RequirementConfigSchema } from "../../Requirements/schema/RequirementConfigSchema.js";
import { StepSchema } from "./StepSchema.js";
import type { BlueprintConfig, BlueprintTargetConfig, WrittenStep } from "./BlueprintConfig.js";

const metadata = {
  kind: "openstrap.blueprint",
  schemaId: "https://openstrap.dev/schemas/openstrap-blueprint.schema.json",
  title: "OpenStrap blueprint",
  description: "OpenStrap product blueprint. It declares targets and requirements for a run.",
  filePatterns: ["openstrap.yaml", ".openstrap/config.yaml"],
} as const;

export class BlueprintSchema implements ConfigDefinition<BlueprintConfig> {
  private readonly requirements: RequirementConfigSchema;
  private readonly steps: StepSchema;
  private conditions?: ConfigSchemaNode<Record<string, unknown>>;

  readonly kind = metadata.kind;
  readonly schemaId = metadata.schemaId;
  readonly title = metadata.title;
  readonly description = metadata.description;
  readonly filePatterns = metadata.filePatterns;

  constructor(private readonly schema: ConfigSchema) {
    this.requirements = new RequirementConfigSchema(schema);
    this.steps = new StepSchema(schema);
  }

  get rootSchema(): ConfigSchemaNode<BlueprintConfig> {
    return this.schema.strictObject({
      targets: this.schema.record(this.targetName, this.target),
    });
  }

  private get name(): ConfigSchemaNode<string> {
    return this.schema.string({
      minLength: 1,
    });
  }

  private get targetName(): ConfigSchemaNode<string> {
    return this.schema.string({
      minLength: 1,
      pattern: "^[a-z][a-z0-9._-]*$",
      patternMessage: "must start with a lowercase letter and use lowercase letters, numbers, '.', '_', or '-'",
    });
  }

  private get transportId(): ConfigSchemaNode<string> {
    return this.schema.string({
      minLength: 1,
      pattern: "^[a-z][a-z0-9._:-]*$",
      patternMessage: "must start with a lowercase letter and use lowercase letters, numbers, '.', '_', ':' or '-'",
    });
  }

  private get target(): ConfigSchemaNode<BlueprintTargetConfig> {
    return this.schema.checked(this.written, (target) => [...namedOnce(target), ...forWhatIsDeclared(target)]);
  }

  private get written(): ConfigSchemaNode<BlueprintTargetConfig> {
    return this.schema.strictObject({
      displayName: this.schema.optional(this.name),
      transport: this.schema.optional(this.transportId),
      provider: this.schema.optional(this.identifier),
      image: this.schema.optional(this.name),
      size: this.schema.optional(this.name),
      // What has to be true, and — where openstrap is expected to make it true — how, written
      // inside the requirement it answers. One thought in one place: nothing names a requirement
      // twice, and nothing points at one that is not there.
      requirements: this.schema.optional(this.requirements.ofOneTarget(this.stepsOf("implied"))),
      // The exception: a step that makes more than one requirement true, and so belongs in neither.
      // It names them, which is the cost of being written out here.
      steps: this.schema.optional(this.stepsOf("named")),
    });
  }

  /**
   * Steps, told whether one written here may name the facts it answers.
   *
   * The conditions a guard may hold are built once and handed to both places. They are the whole
   * vocabulary of the facts and they are enormous; two of them are the same schema written twice,
   * and a JSON Schema emitter has no way to know that unless it is the same node.
   */
  private stepsOf(answers: "named" | "implied"): ConfigSchemaNode<WrittenStep[]> {
    this.conditions ??= this.requirements.factConditions();

    return this.steps.ofOnePlace(this.conditions, answers);
  }

  private get identifier(): ConfigSchemaNode<string> {
    return this.schema.string({
      minLength: 1,
      pattern: "^[a-z][a-z0-9._:-]*$",
      patternMessage: "must start with a lowercase letter and use lowercase letters, numbers, '.', '_', ':' or '-'",
    });
  }
}

/**
 * One name, one step, across the whole target.
 *
 * Each list of steps is checked for repeats on its own, and that is not enough: a step under one
 * requirement and a step under another are two lists, and two steps of the same name in them are
 * one step in the plan — steps are gathered by name, so the second would quietly replace the first
 * and one of the two would never run.
 *
 * A rule about the target rather than about any list in it, which is why it is written here and in
 * code: neither of the two is the wrong one, and the shape of a file cannot say this.
 */
function namedOnce(target: BlueprintTargetConfig): ConfigIssue[] {
  const written = new Map<string, string>();
  const issues: ConfigIssue[] = [];
  const places: Array<{ steps: readonly WrittenStep[]; where: string[]; underneath: string }> = [
    ...(target.requirements ?? []).map((requirement, index) => ({
      steps: requirement.steps ?? [],
      where: ["requirements", String(index), "steps"],
      underneath: `"${requirement.id}"`,
    })),
    { steps: target.steps ?? [], where: ["steps"], underneath: "the target" },
  ];

  for (const place of places) {
    place.steps.forEach((step, index) => {
      const first = written.get(step.id);

      if (first === undefined) {
        written.set(step.id, place.underneath);
        return;
      }

      issues.push({
        path: [...place.where, String(index), "id"],
        message: `already the name of a step under ${first}; one name is one step`,
      });
    });
  }

  return issues;
}

/**
 * A step beside the requirements is for requirements that are there.
 *
 * The only thing a name can be got wrong in, now that steps name requirements rather than copying
 * fact paths — and unlike a path, a name can be checked against something. A step for a requirement
 * nobody declared would validate, load, and never be planned, which is the failure this whole
 * spelling was chosen to make impossible.
 */
function forWhatIsDeclared(target: BlueprintTargetConfig): ConfigIssue[] {
  const declared = new Set((target.requirements ?? []).map((requirement) => requirement.id));

  return (target.steps ?? []).flatMap((step, index) =>
    (step.for ?? [])
      .map((name, at) => ({ name, at }))
      .filter(({ name }) => !declared.has(name))
      .map(({ name, at }) => ({
        path: ["steps", String(index), "for", String(at)],
        message: `no requirement of this target is called "${name}"`,
      })),
  );
}
