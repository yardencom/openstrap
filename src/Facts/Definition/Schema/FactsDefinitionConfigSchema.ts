import type { ConfigSchema, ConfigDefinition } from "../../../ConfigCore/index.js";
import type { FactsDefinition } from "../Domain/Entities/FactsDefinition.js";
import { FactsDefinitionSchema } from "./FactsDefinitionSchema.js";

export class FactsDefinitionConfigSchema {
  static build(schema: ConfigSchema): ConfigDefinition<FactsDefinition> {
    return schema.define<FactsDefinition>({
      kind: "facts.definition",
      schemaId: "https://openstrap.dev/schemas/facts-definition.schema.json",
      title: "OpenStrap facts definition",
      description:
        "Reusable desired facts definition. It describes what to collect, not target, transport, workflow, storage, or export settings.",
      filePatterns: ["openstrap.facts.yaml", ".openstrap/facts.yaml"],
      rootSchema: new FactsDefinitionSchema(schema).build(),
    });
  }
}
