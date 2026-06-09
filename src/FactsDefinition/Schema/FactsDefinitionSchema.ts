import {
  type ConfigSchema,
  type ConfigSchemaNode,
} from "../../ConfigCore/index.js";
import type { ArtifactFact } from "../Domain/Entities/ArtifactFact.js";
import type { CommandFact } from "../Domain/Entities/CommandFact.js";
import type { EnvFact } from "../Domain/Entities/EnvFact.js";
import type { FactsDefinition } from "../Domain/Entities/FactsDefinition.js";
import type { FileFact } from "../Domain/Entities/FileFact.js";
import type { GroupFact } from "../Domain/Entities/GroupFact.js";
import type { PackageFact } from "../Domain/Entities/PackageFact.js";
import type { ProcessFact } from "../Domain/Entities/ProcessFact.js";
import type { ServiceFact } from "../Domain/Entities/ServiceFact.js";
import type { SessionFact } from "../Domain/Entities/SessionFact.js";
import type { UserFact } from "../Domain/Entities/UserFact.js";
import { FactDeclarationSection } from "../Domain/ValueObjects/FactDeclarationSection.js";
import { FactInputSchema } from "./FactInputSchema.js";
import { FactSectionSchemas } from "./FactSectionSchemas.js";
import { FactsSchemaPrimitives } from "./FactsSchemaPrimitives.js";

export class FactsDefinitionSchema {
  private readonly primitives: FactsSchemaPrimitives;
  private readonly inputSchema: FactInputSchema;
  private readonly sectionSchemas: FactSectionSchemas;

  constructor(private readonly schema: ConfigSchema) {
    this.primitives = new FactsSchemaPrimitives(schema);
    this.inputSchema = new FactInputSchema(schema);
    this.sectionSchemas = new FactSectionSchemas(schema);
  }

  build(): ConfigSchemaNode<FactsDefinition> {
    return this.schema.strictObject(
      {
        id: this.primitives.factId(),
        version: this.primitives.positiveInteger(),
        description: this.primitives.nonEmptyString(),
        inputs: this.schema.optional(this.schema.record(this.primitives.factId(), this.inputSchema.build())),
        [FactDeclarationSection.Commands]: this.factArray(this.sectionSchemas.command()),
        [FactDeclarationSection.Env]: this.factArray(this.sectionSchemas.env()),
        [FactDeclarationSection.Files]: this.factArray(this.sectionSchemas.file()),
        [FactDeclarationSection.Processes]: this.factArray(this.sectionSchemas.process()),
        [FactDeclarationSection.Packages]: this.factArray(this.sectionSchemas.package()),
        [FactDeclarationSection.Users]: this.factArray(this.sectionSchemas.user()),
        [FactDeclarationSection.Groups]: this.factArray(this.sectionSchemas.group()),
        [FactDeclarationSection.Services]: this.factArray(this.sectionSchemas.service()),
        [FactDeclarationSection.Sessions]: this.factArray(this.sectionSchemas.session()),
        [FactDeclarationSection.Artifacts]: this.factArray(this.sectionSchemas.artifact()),
      },
      {
        requireAtLeastOneField: this.factSections(),
      },
    );
  }

  private factArray<TFact extends FactSection>(schema: ConfigSchemaNode<TFact>): ConfigSchemaNode<TFact[] | undefined> {
    return this.schema.optional(this.schema.array(schema, { uniqueBy: ["id"] }));
  }

  private factSections(): string[] {
    return Object.values(FactDeclarationSection);
  }
}

type FactSection =
  | CommandFact
  | EnvFact
  | FileFact
  | ProcessFact
  | PackageFact
  | UserFact
  | GroupFact
  | ServiceFact
  | SessionFact
  | ArtifactFact;
