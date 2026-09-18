import { z } from "zod";

import type { ConfigSchemaNode } from "../../ConfigSchemaNode.js";
import type { ZodSchemaMetadataRegistry } from "./ZodSchemaMetadataRegistry.js";

type ArrayUniquenessPolicyResult<TValue> = {
  schema: z.ZodType<TValue[]>;
  schemaMetadata: Record<string, unknown>;
};

export class ZodArrayUniquenessPolicy {
  static apply<TValue>(params: {
    schema: z.ZodType<TValue[]>;
    element: ConfigSchemaNode<TValue>;
    metadata: ZodSchemaMetadataRegistry;
    uniqueBy: readonly string[];
  }): ArrayUniquenessPolicyResult<TValue> {
    const elementValueKind = params.metadata.getValueKind(params.element);
    const schemaMetadata: Record<string, unknown> = {};
    let schema = params.schema;

    if (elementValueKind === "object") {
      ZodArrayUniquenessPolicy.assertObjectArrayUniqueByFields(params.metadata.getFields(params.element), params.uniqueBy);
    } else if (params.uniqueBy.length > 0) {
      throw new Error("Config array uniqueBy fields are only supported for object arrays");
    }

    if (elementValueKind === "primitive") {
      schema = schema.superRefine(ZodArrayUniquenessPolicy.addUniqueValueIssues);
      schemaMetadata.uniqueItems = true;
    }

    if (params.uniqueBy.length > 0) {
      schema = schema.superRefine((items, context) => {
        for (const fieldName of params.uniqueBy) {
          ZodArrayUniquenessPolicy.addUniqueFieldIssues(items, fieldName, context);
        }
      });
      schemaMetadata["x-uniqueFields"] = params.uniqueBy;
    }

    return {
      schema,
      schemaMetadata,
    };
  }

  private static assertObjectArrayUniqueByFields(fields: ReadonlySet<string> | undefined, uniqueBy: readonly string[]): void {
    if (uniqueBy.length === 0) {
      throw new Error("Config object arrays must declare uniqueBy fields");
    }

    for (const fieldName of uniqueBy) {
      if (!fields?.has(fieldName)) {
        throw new Error(`Config object array uniqueBy field '${fieldName}' does not exist`);
      }
    }
  }

  private static addUniqueValueIssues(items: unknown[], context: z.RefinementCtx): void {
    const seenValues = new Set<string>();

    items.forEach((item, index) => {
      if (!ZodArrayUniquenessPolicy.isPrimitiveValue(item)) {
        return;
      }

      const valueKey = ZodArrayUniquenessPolicy.primitiveValueKey(item);

      if (seenValues.has(valueKey)) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "Expected unique array values",
        });
      }

      seenValues.add(valueKey);
    });
  }

  private static addUniqueFieldIssues(items: unknown[], fieldName: string, context: z.RefinementCtx): void {
    const seenValues = new Set<string>();

    items.forEach((item, index) => {
      if (!ZodArrayUniquenessPolicy.isPlainRecord(item) || !Object.prototype.hasOwnProperty.call(item, fieldName)) {
        context.addIssue({
          code: "custom",
          path: [index, fieldName],
          message: `Expected uniqueBy field '${fieldName}' to be present`,
        });
        return;
      }

      const fieldValue = item[fieldName];

      if (!ZodArrayUniquenessPolicy.isPrimitiveValue(fieldValue)) {
        context.addIssue({
          code: "custom",
          path: [index, fieldName],
          message: `Expected uniqueBy field '${fieldName}' to be a primitive value`,
        });
        return;
      }

      const fieldValueKey = ZodArrayUniquenessPolicy.primitiveValueKey(fieldValue);

      if (seenValues.has(fieldValueKey)) {
        context.addIssue({
          code: "custom",
          path: [index, fieldName],
          message: `Expected unique '${fieldName}' values`,
        });
      }

      seenValues.add(fieldValueKey);
    });
  }

  private static isPrimitiveValue(value: unknown): value is string | number | boolean | null {
    return value === null || ["string", "number", "boolean"].includes(typeof value);
  }

  private static primitiveValueKey(value: string | number | boolean | null): string {
    return `${typeof value}:${String(value)}`;
  }

  private static isPlainRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }
}
