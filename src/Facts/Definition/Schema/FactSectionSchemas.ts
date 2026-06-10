import type { ConfigSchema, ConfigSchemaNode } from "../../../ConfigCore/index.js";
import type { ArtifactFact } from "../Domain/Entities/ArtifactFact.js";
import type { CommandFact } from "../Domain/Entities/CommandFact.js";
import type { EnvFact } from "../Domain/Entities/EnvFact.js";
import type { FileFact } from "../Domain/Entities/FileFact.js";
import type { GroupFact } from "../Domain/Entities/GroupFact.js";
import type { PackageFact } from "../Domain/Entities/PackageFact.js";
import type { ProcessFact } from "../Domain/Entities/ProcessFact.js";
import type { ServiceFact } from "../Domain/Entities/ServiceFact.js";
import type { SessionFact } from "../Domain/Entities/SessionFact.js";
import type { UserFact } from "../Domain/Entities/UserFact.js";
import { ArtifactCapture } from "../Domain/ValueObjects/ArtifactCapture.js";
import { FileRequirement } from "../Domain/ValueObjects/FileRequirement.js";
import { SessionKind } from "../Domain/ValueObjects/SessionKind.js";
import { FactSettingsSchema } from "./FactSettingsSchema.js";
import { FactsDefinitionSchemaPrimitives } from "./FactsDefinitionSchemaPrimitives.js";

export class FactSectionSchemas {
  private readonly settings: FactSettingsSchema;
  private readonly primitives: FactsDefinitionSchemaPrimitives;

  constructor(private readonly schema: ConfigSchema) {
    this.settings = new FactSettingsSchema(schema);
    this.primitives = new FactsDefinitionSchemaPrimitives(schema);
  }

  command(): ConfigSchemaNode<CommandFact> {
    return this.schema.strictObject({
      ...this.settings.properties(),
      name: this.primitives.nonEmptyString(),
      args: this.schema.optional(this.schema.array(this.schema.string())),
    });
  }

  env(): ConfigSchemaNode<EnvFact> {
    return this.schema.strictObject({
      ...this.settings.properties(),
      names: this.schema.array(this.primitives.nonEmptyString(), { nonempty: true }),
    });
  }

  file(): ConfigSchemaNode<FileFact> {
    return this.schema.strictObject({
      ...this.settings.properties(),
      path: this.primitives.nonEmptyString(),
      require: this.schema.optional(
        this.schema.array(this.schema.enum(FileRequirement), { nonempty: true }),
      ),
    });
  }

  process(): ConfigSchemaNode<ProcessFact> {
    return this.schema.strictObject({
      ...this.settings.properties(),
      name: this.schema.optional(this.primitives.nonEmptyString()),
      command: this.schema.optional(this.primitives.nonEmptyString()),
      pidFile: this.schema.optional(this.primitives.nonEmptyString()),
    });
  }

  package(): ConfigSchemaNode<PackageFact> {
    return this.schema.strictObject({
      ...this.settings.properties(),
      names: this.schema.array(this.primitives.nonEmptyString(), { nonempty: true }),
      manager: this.schema.optional(this.primitives.nonEmptyString()),
    });
  }

  user(): ConfigSchemaNode<UserFact> {
    return this.schema.strictObject(
      {
        ...this.settings.properties(),
        name: this.schema.optional(this.primitives.nonEmptyString()),
        uid: this.schema.optional(this.schema.union<number | string>([
          this.primitives.nonnegativeInteger(),
          this.primitives.nonEmptyString(),
        ])),
      },
      {
        requireAtLeastOneField: ["name", "uid"],
      },
    );
  }

  group(): ConfigSchemaNode<GroupFact> {
    return this.schema.strictObject(
      {
        ...this.settings.properties(),
        name: this.schema.optional(this.primitives.nonEmptyString()),
        gid: this.schema.optional(this.schema.union<number | string>([
          this.primitives.nonnegativeInteger(),
          this.primitives.nonEmptyString(),
        ])),
      },
      {
        requireAtLeastOneField: ["name", "gid"],
      },
    );
  }

  service(): ConfigSchemaNode<ServiceFact> {
    return this.schema.strictObject({
      ...this.settings.properties(),
      name: this.primitives.nonEmptyString(),
      manager: this.schema.optional(this.primitives.nonEmptyString()),
    });
  }

  session(): ConfigSchemaNode<SessionFact> {
    return this.schema.strictObject({
      ...this.settings.properties(),
      kind: this.schema.optional(this.schema.enum(SessionKind)),
      owner: this.schema.optional(this.primitives.nonEmptyString()),
    });
  }

  artifact(): ConfigSchemaNode<ArtifactFact> {
    return this.schema.strictObject({
      ...this.settings.properties(),
      path: this.primitives.nonEmptyString(),
      kind: this.schema.optional(this.primitives.nonEmptyString()),
      capture: this.schema.defaulted(this.schema.enum(ArtifactCapture), ArtifactCapture.Metadata),
    });
  }
}
