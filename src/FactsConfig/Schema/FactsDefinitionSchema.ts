import {
  configSchema,
  type ConfigSchemaNodeDto,
} from "../../ConfigCore/index.js";
import { FactDeclarationSection } from "../Domain/ValueObjects/FactDeclarationSection.js";
import { FactInputSchema } from "./FactInputSchema.js";
import { FactSectionSchemas } from "./FactSectionSchemas.js";
import { FactsConfigPrimitives } from "./FactsConfigPrimitives.js";

export class FactsDefinitionSchema {
  static build(): ConfigSchemaNodeDto {
    return configSchema.strictObject(
      {
        id: FactsConfigPrimitives.factId(),
        version: FactsConfigPrimitives.positiveInteger(),
        description: FactsConfigPrimitives.nonEmptyString(),
        inputs: configSchema.optional(configSchema.record(FactsConfigPrimitives.factId(), FactInputSchema.build())),
        [FactDeclarationSection.Commands]: this.factArray(FactSectionSchemas.command()),
        [FactDeclarationSection.Env]: this.factArray(FactSectionSchemas.env()),
        [FactDeclarationSection.Files]: this.factArray(FactSectionSchemas.file()),
        [FactDeclarationSection.Processes]: this.factArray(FactSectionSchemas.process()),
        [FactDeclarationSection.Packages]: this.factArray(FactSectionSchemas.package()),
        [FactDeclarationSection.Users]: this.factArray(FactSectionSchemas.user()),
        [FactDeclarationSection.Groups]: this.factArray(FactSectionSchemas.group()),
        [FactDeclarationSection.Services]: this.factArray(FactSectionSchemas.service()),
        [FactDeclarationSection.Sessions]: this.factArray(FactSectionSchemas.session()),
        [FactDeclarationSection.Artifacts]: this.factArray(FactSectionSchemas.artifact()),
      },
      {
        requireAtLeastOneField: this.factSections(),
      },
    );
  }

  private static factArray(schema: ConfigSchemaNodeDto): ConfigSchemaNodeDto {
    return configSchema.optional(configSchema.array(schema));
  }

  private static factSections(): string[] {
    return Object.values(FactDeclarationSection);
  }
}
