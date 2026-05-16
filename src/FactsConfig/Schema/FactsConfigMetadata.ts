import { ConfigFilePatternDto, ConfigSchemaMetadataDto } from "../../ConfigCore/index.js";

export class FactsConfigMetadata {
  static build(): ConfigSchemaMetadataDto {
    return new ConfigSchemaMetadataDto({
      kind: "facts.definition",
      schemaId: "https://openstrap.dev/schemas/facts-definition.schema.json",
      title: "OpenStrap facts definition",
      description:
        "Reusable desired facts definition. It describes what to collect, not target, transport, workflow, storage, or export settings.",
      filePatterns: [
        ConfigFilePatternDto.regex({
          pattern: String.raw`^.*\.facts\.ya?ml$`,
          format: "yaml",
          description: "YAML facts definition file ending with .facts.yaml or .facts.yml",
        }),
      ],
    });
  }
}
