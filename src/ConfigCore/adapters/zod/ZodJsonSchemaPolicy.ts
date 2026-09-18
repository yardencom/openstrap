

export class ZodJsonSchemaPolicy {
  static removeDefaultedFieldsFromRequired(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        ZodJsonSchemaPolicy.removeDefaultedFieldsFromRequired(item);
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
        .filter(([, propertySchema]) => ZodJsonSchemaPolicy.hasOwnProperty(propertySchema, "default"))
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
      ZodJsonSchemaPolicy.removeDefaultedFieldsFromRequired(child);
    }
  }

  private static hasOwnProperty(value: unknown, propertyName: string): boolean {
    return Boolean(value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, propertyName));
  }
}
