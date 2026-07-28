import {
  type ConfigDefinition,
  type ConfigSchema,
  type ConfigSchemaNode,
} from "../../../ConfigCore/index.js";
import { RequirementConfigSchema } from "../../Requirements/Schema/RequirementConfigSchema.js";
import type { BlueprintConfig, BlueprintTargetConfig } from "./BlueprintConfig.js";

const metadata = {
  kind: "openstrap.blueprint",
  schemaId: "https://openstrap.dev/schemas/openstrap-blueprint.schema.json",
  title: "OpenStrap blueprint",
  description: "OpenStrap product blueprint. It declares targets and requirements for a run.",
  filePatterns: ["openstrap.yaml", ".openstrap/config.yaml"],
} as const;

export class BlueprintSchema implements ConfigDefinition<BlueprintConfig> {
  private readonly requirements: RequirementConfigSchema;

  readonly kind = metadata.kind;
  readonly schemaId = metadata.schemaId;
  readonly title = metadata.title;
  readonly description = metadata.description;
  readonly filePatterns = metadata.filePatterns;

  constructor(private readonly schema: ConfigSchema) {
    this.requirements = new RequirementConfigSchema(schema);
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
    return this.schema.strictObject({
      displayName: this.schema.optional(this.name),
      transport: this.schema.optional(this.transportId),
      provider: this.schema.optional(this.identifier),
      image: this.schema.optional(this.name),
      size: this.schema.optional(this.name),
      requirements: this.schema.optional(this.schema.array(this.requirements.withoutTarget(), {
        uniqueBy: ["id"],
      })),
    });
  }

  private get identifier(): ConfigSchemaNode<string> {
    return this.schema.string({
      minLength: 1,
      pattern: "^[a-z][a-z0-9._:-]*$",
      patternMessage: "must start with a lowercase letter and use lowercase letters, numbers, '.', '_', ':' or '-'",
    });
  }
}
