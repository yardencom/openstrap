import { z } from "zod";

import type { ConfigDefinition } from "../../Domain/ConfigDefinition.js";
import type { JsonSchema } from "../../Ports/ConfigJsonSchemaBackend.js";
import { removeDefaultedFieldsFromRequired } from "./ZodJsonSchemaPolicy.js";
import type { ZodSchemaRegistry } from "./ZodSchemaRegistry.js";

export class ZodJsonSchemaEmitter {
  constructor(private readonly schemas: ZodSchemaRegistry) {}

  emit<TConfig>(definition: ConfigDefinition<TConfig>): JsonSchema {
    const jsonSchema = z.toJSONSchema(this.schemas.get(definition.rootSchema), {
      target: "draft-7",
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
