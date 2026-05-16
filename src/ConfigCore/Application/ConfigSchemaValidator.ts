import type {
  ConfigIssueDto,
  ParsedConfigDocumentDto,
  ValidatedConfigDocumentDto,
} from "../Domain/ConfigDtos.js";
import { ConfigValidationError } from "../Domain/ConfigErrors.js";
import type { ConfigSchemaDefinitionDto } from "../Domain/ConfigSchemaDefinitionDto.js";
import type { ConfigSchemaNodeDto } from "../Domain/ConfigSchemaNodes.js";
import type { ConfigValidator } from "../Ports/ConfigValidator.js";

type ValidationResult =
  | {
      success: true;
      value: unknown;
    }
  | {
      success: false;
      issues: ConfigIssueDto[];
    };

export class ConfigSchemaValidator<TConfig> implements ConfigValidator<TConfig> {
  constructor(private readonly definition: ConfigSchemaDefinitionDto<TConfig>) {}

  validate(document: ParsedConfigDocumentDto): ValidatedConfigDocumentDto<TConfig> {
    const result = validateNode(this.definition.rootSchema, document.value, []);

    if (!result.success) {
      throw new ConfigValidationError({
        kind: this.definition.metadata.kind,
        schemaId: this.definition.metadata.schemaId,
        issues: result.issues,
      });
    }

    return {
      kind: this.definition.metadata.kind,
      schemaId: this.definition.metadata.schemaId,
      source: document.source,
      config: result.value as TConfig,
    };
  }
}

function validateNode(node: ConfigSchemaNodeDto, value: unknown, path: string[]): ValidationResult {
  if (value === undefined) {
    if (node.hasDefault) {
      return {
        success: true,
        value: node.defaultValue,
      };
    }

    if (node.isOptional) {
      return {
        success: true,
        value: undefined,
      };
    }

    return fail(path, "Required");
  }

  const baseResult = validatePresentNode(node, value, path);

  if (!baseResult.success) {
    return baseResult;
  }

  return applyRefinements(node, baseResult.value, path);
}

function validatePresentNode(node: ConfigSchemaNodeDto, value: unknown, path: string[]): ValidationResult {
  switch (node.kind) {
    case "string":
      return validateString(node, value, path);
    case "number":
      return validateNumber(node, value, path);
    case "boolean":
      return typeof value === "boolean" ? pass(value) : fail(path, "Expected boolean");
    case "unknown":
      return pass(value);
    case "literal":
      return Object.is(value, node.value) ? pass(value) : fail(path, `Expected literal ${String(node.value)}`);
    case "enum":
      return typeof value === "string" && node.values.includes(value)
        ? pass(value)
        : fail(path, `Expected one of: ${node.values.join(", ")}`);
    case "array":
      return validateArray(node, value, path);
    case "object":
      return validateObject(node, value, path);
    case "record":
      return validateRecord(node, value, path);
    case "union":
      return validateUnion(node.variants, value, path);
    case "discriminatedUnion":
      return validateDiscriminatedUnion(node, value, path);
  }
}

function validateString(
  node: Extract<ConfigSchemaNodeDto, { kind: "string" }>,
  value: unknown,
  path: string[],
): ValidationResult {
  if (typeof value !== "string") {
    return fail(path, "Expected string");
  }

  if (node.minLength !== undefined && value.length < node.minLength) {
    return fail(path, `Expected string with at least ${node.minLength} character(s)`);
  }

  if (node.pattern !== undefined && !new RegExp(node.pattern).test(value)) {
    return fail(path, node.patternMessage ?? "String does not match the required pattern");
  }

  return pass(value);
}

function validateNumber(
  node: Extract<ConfigSchemaNodeDto, { kind: "number" }>,
  value: unknown,
  path: string[],
): ValidationResult {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fail(path, "Expected number");
  }

  if (node.int && !Number.isInteger(value)) {
    return fail(path, "Expected integer");
  }

  if (node.positive && value <= 0) {
    return fail(path, "Expected positive number");
  }

  if (node.nonnegative && value < 0) {
    return fail(path, "Expected nonnegative number");
  }

  return pass(value);
}

function validateArray(
  node: Extract<ConfigSchemaNodeDto, { kind: "array" }>,
  value: unknown,
  path: string[],
): ValidationResult {
  if (!Array.isArray(value)) {
    return fail(path, "Expected array");
  }

  if (node.nonempty && value.length === 0) {
    return fail(path, "Expected nonempty array");
  }

  const output: unknown[] = [];
  const issues: ConfigIssueDto[] = [];

  value.forEach((item, index) => {
    const result = validateNode(node.element, item, [...path, String(index)]);

    if (result.success) {
      output.push(result.value);
      return;
    }

    issues.push(...result.issues);
  });

  for (const uniqueField of getArrayUniqueFields(node)) {
    issues.push(...validateUniqueField(output, uniqueField, path));
  }

  return issues.length > 0 ? { success: false, issues } : pass(output);
}

function validateObject(
  node: Extract<ConfigSchemaNodeDto, { kind: "object" }>,
  value: unknown,
  path: string[],
): ValidationResult {
  if (!isPlainRecord(value)) {
    return fail(path, "Expected object");
  }

  const output: Record<string, unknown> = {};
  const issues: ConfigIssueDto[] = [];

  if (node.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!Object.prototype.hasOwnProperty.call(node.properties, key)) {
        issues.push({
          path: [...path, key],
          message: "Unknown property",
          code: "unrecognized_property",
        });
      }
    }
  }

  for (const [propertyName, propertySchema] of Object.entries(node.properties)) {
    const hasProperty = Object.prototype.hasOwnProperty.call(value, propertyName);
    const result = validateNode(propertySchema, hasProperty ? value[propertyName] : undefined, [...path, propertyName]);

    if (!result.success) {
      issues.push(...result.issues);
      continue;
    }

    if (hasProperty || propertySchema.hasDefault) {
      output[propertyName] = result.value;
    }
  }

  if (node.requireAtLeastOneField && !hasAtLeastOneField(output, node.requireAtLeastOneField)) {
    issues.push({
      path,
      message: `Expected at least one of fields: ${node.requireAtLeastOneField.join(", ")}`,
      code: "missing_required_field_choice",
    });
  }

  return issues.length > 0 ? { success: false, issues } : pass(output);
}

function validateUniqueField(items: unknown[], fieldName: string, path: string[]): ConfigIssueDto[] {
  const issues: ConfigIssueDto[] = [];
  const seenValues = new Set<string>();

  for (const item of items) {
    if (!isPlainRecord(item) || !Object.prototype.hasOwnProperty.call(item, fieldName)) {
      continue;
    }

    const fieldValue = String(item[fieldName]);

    if (seenValues.has(fieldValue)) {
      issues.push({
        path,
        message: `Expected unique '${fieldName}' values`,
        code: "duplicate_unique_field",
      });
    }

    seenValues.add(fieldValue);
  }

  return issues;
}

function getArrayUniqueFields(node: Extract<ConfigSchemaNodeDto, { kind: "array" }>): string[] {
  const fields = new Set<string>();

  if (schemaHasField(node.element, "id")) {
    fields.add("id");
  }

  for (const fieldName of node.uniqueFields ?? []) {
    fields.add(fieldName);
  }

  return [...fields];
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

function hasAtLeastOneField(value: Record<string, unknown>, fieldNames: readonly string[]): boolean {
  return fieldNames.some((fieldName) => hasRequiredFieldValue(value[fieldName]));
}

function hasRequiredFieldValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    return value.length > 0;
  }

  if (isPlainRecord(value)) {
    return Object.keys(value).length > 0;
  }

  return true;
}

function validateRecord(
  node: Extract<ConfigSchemaNodeDto, { kind: "record" }>,
  value: unknown,
  path: string[],
): ValidationResult {
  if (!isPlainRecord(value)) {
    return fail(path, "Expected object");
  }

  const output: Record<string, unknown> = {};
  const issues: ConfigIssueDto[] = [];

  for (const [key, childValue] of Object.entries(value)) {
    const keyResult = validateNode(node.key, key, [...path, key]);
    const valueResult = validateNode(node.value, childValue, [...path, key]);

    if (!keyResult.success) {
      issues.push(...keyResult.issues);
    }

    if (!valueResult.success) {
      issues.push(...valueResult.issues);
      continue;
    }

    output[key] = valueResult.value;
  }

  return issues.length > 0 ? { success: false, issues } : pass(output);
}

function validateUnion(variants: readonly ConfigSchemaNodeDto[], value: unknown, path: string[]): ValidationResult {
  for (const variant of variants) {
    const result = validateNode(variant, value, path);

    if (result.success) {
      return result;
    }
  }

  return fail(path, "Expected one of the allowed schema variants", "invalid_union");
}

function validateDiscriminatedUnion(
  node: Extract<ConfigSchemaNodeDto, { kind: "discriminatedUnion" }>,
  value: unknown,
  path: string[],
): ValidationResult {
  if (!isPlainRecord(value)) {
    return fail(path, "Expected object");
  }

  const discriminatorValue = value[node.discriminator];

  if (typeof discriminatorValue !== "string") {
    return fail([...path, node.discriminator], "Expected string discriminator");
  }

  const variant = node.variants[discriminatorValue];

  if (!variant) {
    return fail([...path, node.discriminator], `Expected one of: ${Object.keys(node.variants).join(", ")}`);
  }

  return validateNode(variant, value, path);
}

function applyRefinements(node: ConfigSchemaNodeDto, value: unknown, path: string[]): ValidationResult {
  if (!node.refinements?.length) {
    return pass(value);
  }

  const issues: ConfigIssueDto[] = [];

  for (const refinement of node.refinements) {
    refinement(value, {
      addIssue(issue) {
        issues.push({
          path: [...path, ...(issue.path ?? [])],
          message: issue.message,
          code: issue.code,
        });
      },
    });
  }

  return issues.length > 0 ? { success: false, issues } : pass(value);
}

function pass(value: unknown): ValidationResult {
  return {
    success: true,
    value,
  };
}

function fail(path: string[], message: string, code?: string): ValidationResult {
  return {
    success: false,
    issues: [
      {
        path,
        message,
        code,
      },
    ],
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
