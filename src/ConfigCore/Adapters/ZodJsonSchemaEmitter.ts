import { z } from "zod";

import type { JsonSchemaDocumentDto } from "../Domain/ConfigDtos.js";
import type { JsonSchemaEmitter } from "../Ports/JsonSchemaEmitter.js";
import type { ZodConfigSchemaDefinition } from "./ZodConfigSchemaDefinition.js";

export class ZodJsonSchemaEmitter<TSchema extends z.ZodType>
  implements JsonSchemaEmitter<ZodConfigSchemaDefinition<TSchema>>
{
  emit(definition: ZodConfigSchemaDefinition<TSchema>): JsonSchemaDocumentDto {
    const jsonSchema = z.toJSONSchema(definition.schema, {
      target: "draft-7",
    }) as JsonSchemaDocumentDto;

    removeDefaultedFieldsFromRequired(jsonSchema);

    return {
      ...jsonSchema,
      $id: definition.metadata.schemaId,
      title: definition.metadata.title,
      description: definition.metadata.description,
    };
  }
}

function removeDefaultedFieldsFromRequired(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      removeDefaultedFieldsFromRequired(item);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const schemaObject = value as {
    properties?: Record<string, unknown>;
    required?: unknown;
  };

  if (schemaObject.properties && Array.isArray(schemaObject.required)) {
    const requiredFields = schemaObject.required;
    const defaultedFields = Object.entries(schemaObject.properties)
      .filter(([, propertySchema]) => hasOwnProperty(propertySchema, "default"))
      .map(([fieldName]) => fieldName);

    if (defaultedFields.length > 0) {
      const remainingRequiredFields = requiredFields.filter(
        (fieldName) => typeof fieldName === "string" && !defaultedFields.includes(fieldName),
      );

      if (remainingRequiredFields.length === 0) {
        delete schemaObject.required;
      } else {
        schemaObject.required = remainingRequiredFields;
      }
    }
  }

  for (const child of Object.values(value)) {
    removeDefaultedFieldsFromRequired(child);
  }
}

function hasOwnProperty(value: unknown, propertyName: string): boolean {
  return Boolean(value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, propertyName));
}
