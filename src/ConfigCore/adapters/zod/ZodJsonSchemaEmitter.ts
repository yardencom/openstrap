import { z } from "zod";

import type { ConfigDefinition } from "../../ConfigDefinition.js";
import type { JsonSchema } from "../../ports/ConfigJsonSchemaBackend.js";
import { removeDefaultedFieldsFromRequired } from "./ZodJsonSchemaPolicy.js";
import type { ZodSchemaRegistry } from "./ZodSchemaRegistry.js";

export class ZodJsonSchemaEmitter {
  constructor(private readonly schemas: ZodSchemaRegistry) {}

  emit<TConfig>(definition: ConfigDefinition<TConfig>): JsonSchema {
    const jsonSchema = z.toJSONSchema(this.schemas.get(definition.rootSchema), {
      target: "draft-7",
      // A schema used in two places is written once and pointed at twice. Inlining is the default
      // and it was fine while nothing was used twice; the conditions a fact may be written under
      // are now the language of a requirement and the language of a step's guard, and they are the
      // whole model of a machine. Inlined, the blueprint schema was three times the size of the
      // vocabulary it describes.
      reused: "ref",
    }) as JsonSchema;

    removeDefaultedFieldsFromRequired(jsonSchema);

    const { $schema, ...body } = jsonSchema;

    return {
      $schema,
      $id: definition.schemaId,
      title: definition.title,
      description: definition.description,
      ...body,
    };
  }
}
