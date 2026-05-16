import type { JsonSchemaDocumentDto } from "../Domain/ConfigDtos.js";
import type { ConfigSchemaDefinitionDto } from "../Domain/ConfigSchemaDefinitionDto.js";
import type { ConfigSchemaNodeDto } from "../Domain/ConfigSchemaNodes.js";
import type { JsonSchemaEmitter } from "../Ports/JsonSchemaEmitter.js";

export class ConfigSchemaJsonSchemaEmitter<TConfig> implements JsonSchemaEmitter<ConfigSchemaDefinitionDto<TConfig>> {
  emit(definition: ConfigSchemaDefinitionDto<TConfig>): JsonSchemaDocumentDto {
    return {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: definition.metadata.schemaId,
      title: definition.metadata.title,
      description: definition.metadata.description,
      ...emitNode(definition.rootSchema),
    };
  }
}

function emitNode(node: ConfigSchemaNodeDto): Record<string, unknown> {
  const schema = emitPresentNode(node);

  if (node.hasDefault) {
    schema.default = node.defaultValue;
  }

  return schema;
}

function emitPresentNode(node: ConfigSchemaNodeDto): Record<string, unknown> {
  switch (node.kind) {
    case "string":
      return removeUndefined({
        type: "string",
        minLength: node.minLength,
        pattern: node.pattern,
      });
    case "number":
      return removeUndefined({
        type: node.int ? "integer" : "number",
        exclusiveMinimum: node.positive ? 0 : undefined,
        minimum: node.nonnegative ? 0 : undefined,
      });
    case "boolean":
      return {
        type: "boolean",
      };
    case "unknown":
      return {};
    case "literal":
      return {
        const: node.value,
      };
    case "enum":
      return {
        type: "string",
        enum: [...node.values],
      };
    case "array":
      return removeUndefined({
        type: "array",
        items: emitNode(node.element),
        minItems: node.nonempty ? 1 : undefined,
        "x-uniqueFields": getArrayUniqueFields(node),
      });
    case "object":
      return emitObjectNode(node);
    case "record":
      return {
        type: "object",
        propertyNames: emitNode(node.key),
        additionalProperties: emitNode(node.value),
      };
    case "union":
      return {
        anyOf: node.variants.map(emitNode),
      };
    case "discriminatedUnion":
      return {
        anyOf: Object.values(node.variants).map(emitNode),
      };
  }
}

function emitObjectNode(node: Extract<ConfigSchemaNodeDto, { kind: "object" }>): Record<string, unknown> {
  const properties = Object.fromEntries(
    Object.entries(node.properties).map(([propertyName, propertySchema]) => [propertyName, emitNode(propertySchema)]),
  );
  const required = Object.entries(node.properties)
    .filter(([, propertySchema]) => !propertySchema.isOptional && !propertySchema.hasDefault)
    .map(([propertyName]) => propertyName);

  return removeUndefined({
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined,
    additionalProperties: node.additionalProperties,
    anyOf: emitRequireAtLeastOneFieldOptions(node),
  });
}

function emitRequireAtLeastOneFieldOptions(
  node: Extract<ConfigSchemaNodeDto, { kind: "object" }>,
): Record<string, unknown>[] | undefined {
  if (!node.requireAtLeastOneField?.length) {
    return undefined;
  }

  return node.requireAtLeastOneField.map((fieldName) => {
    const fieldSchema = node.properties[fieldName];

    return removeUndefined({
      required: [fieldName],
      properties:
        fieldSchema?.kind === "array"
          ? {
              [fieldName]: {
                minItems: 1,
              },
            }
          : undefined,
    });
  });
}

function getArrayUniqueFields(node: Extract<ConfigSchemaNodeDto, { kind: "array" }>): string[] | undefined {
  const fields = new Set<string>();

  if (schemaHasField(node.element, "id")) {
    fields.add("id");
  }

  for (const fieldName of node.uniqueFields ?? []) {
    fields.add(fieldName);
  }

  return fields.size > 0 ? [...fields] : undefined;
}

function schemaHasField(node: ConfigSchemaNodeDto, fieldName: string): boolean {
  switch (node.kind) {
    case "object":
      return Object.prototype.hasOwnProperty.call(node.properties, fieldName);
    case "union":
      return node.variants.some((variant) => schemaHasField(variant, fieldName));
    case "discriminatedUnion":
      return Object.values(node.variants).some((variant) => schemaHasField(variant, fieldName));
    default:
      return false;
  }
}

function removeUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined));
}
