import type { ConfigDefinition, ConfigSchema, ConfigSchemaNode } from "../../ConfigCore/index.js";
import type { Requirement } from "../../Requirements/index.js";
import { RequirementConfigSchema } from "../../Requirements/Schema/RequirementConfigSchema.js";
import type {
  BlueprintDocument,
  HostBlueprintSection,
} from "../Domain/BlueprintDocument.js";
import type {
  BlueprintTarget,
  OpenStrapBlueprint,
} from "../Domain/Blueprint.js";

export class BlueprintDocumentSchema {
  static build(schema: ConfigSchema): ConfigDefinition<BlueprintDocument> {
    return schema.define<BlueprintDocument>({
      kind: "openstrap.blueprint",
      schemaId: "https://openstrap.dev/schemas/openstrap-blueprint.schema.json",
      title: "OpenStrap blueprint",
      description:
        "OpenStrap product blueprint. It declares targets and requirements for a local run.",
      filePatterns: ["openstrap.yaml", ".openstrap/config.yaml"],
      rootSchema: schema.union<BlueprintDocument>([
        schema.strictObject({
          host: hostSectionSchema(schema),
        }),
        explicitBlueprintSchema(schema),
      ]),
    });
  }
}

function explicitBlueprintSchema(schema: ConfigSchema): ConfigSchemaNode<OpenStrapBlueprint> {
  return schema.strictObject({
    targets: schema.array(targetSchema(schema), {
      nonempty: true,
      uniqueBy: ["name"],
    }),
    requirements: schema.array(requirementSchema(schema), {
      nonempty: true,
      uniqueBy: ["id"],
    }),
  });
}

function hostSectionSchema(schema: ConfigSchema): ConfigSchemaNode<HostBlueprintSection> {
  const requirements = new RequirementConfigSchema(schema);

  return schema.strictObject({
    displayName: schema.optional(nonEmptyString(schema)),
    requirements: schema.array(requirements.withoutTarget(), {
      nonempty: true,
      uniqueBy: ["id"],
    }),
  });
}

function targetSchema(schema: ConfigSchema): ConfigSchemaNode<BlueprintTarget> {
  return schema.strictObject({
    name: identifier(schema),
    scope: schema.enum(["host", "guest", "network"] as const),
    type: schema.enum(["machine", "vm", "network"] as const),
    displayName: schema.optional(nonEmptyString(schema)),
    transport: schema.literal("local"),
  });
}

function requirementSchema(schema: ConfigSchema): ConfigSchemaNode<Requirement> {
  return new RequirementConfigSchema(schema).withTarget();
}

function identifier(schema: ConfigSchema): ConfigSchemaNode<string> {
  return schema.string({
    minLength: 1,
    pattern: "^[a-z][a-z0-9._-]*$",
    patternMessage: "must start with a lowercase letter and use lowercase letters, numbers, '.', '_', or '-'",
  });
}

function nonEmptyString(schema: ConfigSchema): ConfigSchemaNode<string> {
  return schema.string({
    minLength: 1,
  });
}
