import { z } from "zod";

import { ConfigSchemaNode } from "../../ConfigSchemaNode.js";
import type {
  ConfigArrayOptions,
  ConfigEnumValues,
  ConfigRule,
  ConfigSchemaBuilderBackend,
} from "../../ports/ConfigSchemaBuilderBackend.js";
import { ZodArrayUniquenessPolicy } from "./ZodArrayUniquenessPolicy.js";
import { ZodDiscriminatedUnionPolicy } from "./ZodDiscriminatedUnionPolicy.js";
import type { ZodSchemaLiteralValue, ZodSchemaValueKind } from "./ZodSchemaMetadataRegistry.js";
import { ZodSchemaMetadataRegistry } from "./ZodSchemaMetadataRegistry.js";
import { ZodSchemaRegistry } from "./ZodSchemaRegistry.js";

export class ZodConfigSchemaBuilder implements ConfigSchemaBuilderBackend {
  constructor(
    private readonly schemas: ZodSchemaRegistry,
    private readonly metadata: ZodSchemaMetadataRegistry,
  ) {}

  string(params: { minLength?: number; pattern?: string; patternMessage?: string } = {}): ConfigSchemaNode<string> {
    let schema = z.string();

    if (params.minLength !== undefined) {
      schema = schema.min(params.minLength);
    }

    if (params.pattern !== undefined) {
      schema = schema.regex(new RegExp(params.pattern), params.patternMessage);
    }

    return this.wrap(schema, { valueKind: "primitive" });
  }

  number(params: { int?: boolean; positive?: boolean; nonnegative?: boolean } = {}): ConfigSchemaNode<number> {
    let schema = z.number();

    if (params.int) {
      schema = schema.int();
    }

    if (params.positive) {
      schema = schema.positive();
    }

    if (params.nonnegative) {
      schema = schema.nonnegative();
    }

    return this.wrap(schema, { valueKind: "primitive" });
  }

  boolean(): ConfigSchemaNode<boolean> {
    return this.wrap(z.boolean(), { valueKind: "primitive" });
  }

  unknown(): ConfigSchemaNode<unknown> {
    return this.wrap(z.unknown(), { valueKind: "unknown" });
  }

  literal<TValue extends string | number | boolean | null>(value: TValue): ConfigSchemaNode<TValue> {
    return this.wrap(z.literal(value), {
      literalValue: value,
      valueKind: "primitive",
    });
  }

  enum<const TValue extends string>(values: ConfigEnumValues<TValue>): ConfigSchemaNode<TValue> {
    const enumValues = Array.isArray(values) ? values : Object.values(values);

    if (enumValues.length === 0) {
      throw new Error("Config enum must contain at least one value");
    }

    return this.wrap(z.enum(ZodConfigSchemaBuilder.asNonEmptyTuple(enumValues)) as z.ZodType<TValue>, { valueKind: "primitive" });
  }

  array<TValue>(
    element: ConfigSchemaNode<TValue>,
    params: ConfigArrayOptions = {},
  ): ConfigSchemaNode<TValue[]> {
    let schema: z.ZodType<TValue[]> = z.array(this.unwrap(element));

    if (params.nonempty) {
      schema = z.array(this.unwrap(element)).nonempty();
    }

    const uniqueBy = ZodConfigSchemaBuilder.uniqueFieldNames(params.uniqueBy);
    const uniquenessPolicy = ZodArrayUniquenessPolicy.apply({
      schema,
      element,
      metadata: this.metadata,
      uniqueBy,
    });
    schema = uniquenessPolicy.schema;

    if (Object.keys(uniquenessPolicy.schemaMetadata).length > 0) {
      schema = schema.meta(uniquenessPolicy.schemaMetadata);
    }

    return this.wrap(schema, { valueKind: "unknown" });
  }

  strictObject<TProperties extends ConfigSchemaNode.Record>(
    properties: TProperties,
    params: { requireAtLeastOneField?: readonly string[] } = {},
  ): ConfigSchemaNode<ConfigSchemaNode.RecordValue<TProperties>> {
    const shape: Record<string, z.ZodType> = {};
    const fieldLiterals = new Map<string, ZodSchemaLiteralValue>();

    for (const propertyName in properties) {
      shape[propertyName] = this.unwrap(properties[propertyName]);
      const literalValue = this.metadata.getLiteralValue(properties[propertyName]);

      if (literalValue !== undefined) {
        fieldLiterals.set(propertyName, literalValue);
      }
    }

    let schema = z.strictObject(shape) as z.ZodType<ConfigSchemaNode.RecordValue<TProperties>>;

    if (params.requireAtLeastOneField?.length) {
      const requiredFieldChoices = params.requireAtLeastOneField;
      schema = schema.superRefine((value, context) => {
        if (!ZodConfigSchemaBuilder.hasAtLeastOneField(value, requiredFieldChoices)) {
          context.addIssue({
            code: "custom",
            path: [],
            message: `Expected at least one of fields: ${requiredFieldChoices.join(", ")}`,
          });
        }
      }).meta({
        anyOf: requiredFieldChoices.map((fieldName) => ({
          required: [fieldName],
        })),
      });
    }

    return this.wrap(schema, {
      fieldLiterals,
      fields: Object.keys(properties),
      valueKind: "object",
    });
  }

  record<TValue>(key: ConfigSchemaNode<string>, value: ConfigSchemaNode<TValue>): ConfigSchemaNode<Record<string, TValue>> {
    return this.wrap(z.record(this.unwrap(key), this.unwrap(value)), { valueKind: "unknown" });
  }

  union<TValue>(variants: readonly ConfigSchemaNode<TValue>[]): ConfigSchemaNode<TValue> {
    if (variants.length === 0) {
      throw new Error("Config union must contain at least one variant");
    }

    const schema = variants.length === 1
      ? this.unwrap(variants[0]!)
      : z.union(ZodConfigSchemaBuilder.asUnionTuple(variants.map((variant) => this.unwrap(variant))));

    const node = this.wrap(schema as z.ZodType<TValue>, {
      valueKind: ZodConfigSchemaBuilder.mergeVariantValueKinds(variants.map((variant) => this.metadata.getValueKind(variant))),
    });
    this.setMergedFields(node, variants);

    return node;
  }

  discriminatedUnion<TValue>(
    discriminator: string,
    variants: Record<string, ConfigSchemaNode<object>>,
  ): ConfigSchemaNode<TValue> {
    if (discriminator.length === 0) {
      throw new Error("Config discriminated union discriminator must not be empty");
    }

    const variantNodes = Object.values(variants);

    if (variantNodes.length < 2) {
      throw new Error("Config discriminated union must contain at least two variants");
    }

    const schema = ZodDiscriminatedUnionPolicy.create(
      discriminator,
      variants,
      this.metadata,
      (variant) => this.unwrap(variant),
    );
    const node = this.wrap(schema as z.ZodType<TValue>, { valueKind: "object" });
    this.setMergedFields(node, variantNodes);

    return node;
  }

  optional<TValue>(node: ConfigSchemaNode<TValue>): ConfigSchemaNode<TValue | undefined> {
    const optionalNode = this.wrap(this.unwrap(node).optional());
    this.copyMetadata(node, optionalNode);

    return optionalNode;
  }

  defaulted<TValue>(node: ConfigSchemaNode<TValue>, defaultValue: Exclude<TValue, undefined>): ConfigSchemaNode<TValue> {
    const defaultedNode = this.wrap(this.unwrap(node).default(defaultValue) as z.ZodType<TValue>);
    this.copyMetadata(node, defaultedNode);

    return defaultedNode;
  }

  checked<TValue>(node: ConfigSchemaNode<TValue>, rule: ConfigRule<TValue>): ConfigSchemaNode<TValue> {
    const schema = this.unwrap(node);
    let checked = schema.superRefine((value, context) => {
      for (const issue of rule(value)) {
        context.addIssue({
          code: "custom",
          path: [...issue.path],
          message: issue.message,
        });
      }
    }) as z.ZodType<TValue>;

    // A check makes a new schema, and what the emitted JSON Schema says about this node was written
    // on the old one. Carried over, or a rule would quietly cost the editor everything the node had
    // told it.
    const emitted = z.globalRegistry.get(schema);

    if (emitted) {
      checked = checked.meta({ ...emitted });
    }

    const checkedNode = this.wrap(checked);
    this.copyMetadata(node, checkedNode);

    return checkedNode;
  }

  private wrap<TValue>(
    schema: z.ZodType<TValue>,
    metadata: {
      fields?: readonly string[];
      fieldLiterals?: ReadonlyMap<string, ZodSchemaLiteralValue>;
      literalValue?: ZodSchemaLiteralValue;
      valueKind?: ZodSchemaValueKind;
    } = {},
  ): ConfigSchemaNode<TValue> {
    const node = this.schemas.create(schema);

    if (metadata.fields) {
      this.metadata.setFields(node, metadata.fields);
    }

    if (metadata.fieldLiterals) {
      this.metadata.setFieldLiterals(node, metadata.fieldLiterals);
    }

    if (metadata.literalValue !== undefined) {
      this.metadata.setLiteralValue(node, metadata.literalValue);
    }

    if (metadata.valueKind) {
      this.metadata.setValueKind(node, metadata.valueKind);
    }

    return node;
  }

  private unwrap<TValue>(schema: ConfigSchemaNode<TValue>): z.ZodType<TValue> {
    return this.schemas.get(schema);
  }

  private copyMetadata(source: ConfigSchemaNode<unknown>, target: ConfigSchemaNode<unknown>): void {
    this.metadata.copy(source, target);
  }

  private setMergedFields(target: ConfigSchemaNode<unknown>, variants: readonly ConfigSchemaNode<unknown>[]): void {
    const fields = ZodConfigSchemaBuilder.mergeVariantFields(variants.map((variant) => this.metadata.getFields(variant)));

    if (fields) {
      this.metadata.setFields(target, [...fields]);
    }
  }

  private static mergeVariantFields(fieldSets: Array<ReadonlySet<string> | undefined>): ReadonlySet<string> | undefined {
    const fields = new Set<string>();

    for (const fieldSet of fieldSets) {
      for (const fieldName of fieldSet ?? []) {
        fields.add(fieldName);
      }
    }

    return fields.size > 0 ? fields : undefined;
  }

  private static mergeVariantValueKinds(valueKinds: Array<ZodSchemaValueKind | undefined>): ZodSchemaValueKind {
    const knownValueKinds = valueKinds.filter((valueKind): valueKind is ZodSchemaValueKind => Boolean(valueKind));

    if (knownValueKinds.length === 0) {
      return "unknown";
    }

    const [firstValueKind] = knownValueKinds;

    return knownValueKinds.every((valueKind) => valueKind === firstValueKind) ? firstValueKind : "unknown";
  }

  private static uniqueFieldNames(fieldNames: readonly string[] = []): string[] {
    return [...new Set(fieldNames)];
  }

  private static asNonEmptyTuple<TValue>(values: readonly TValue[]): [TValue, ...TValue[]] {
    if (values.length === 0) {
      throw new Error("Expected at least one value");
    }

    return values as [TValue, ...TValue[]];
  }

  private static asUnionTuple<TValue>(values: readonly TValue[]): [TValue, TValue, ...TValue[]] {
    if (values.length < 2) {
      throw new Error("Expected at least two union variants");
    }

    return values as [TValue, TValue, ...TValue[]];
  }

  private static hasAtLeastOneField(value: Record<string, unknown>, fieldNames: readonly string[]): boolean {
    return fieldNames.some((fieldName) => ZodConfigSchemaBuilder.hasRequiredFieldValue(value[fieldName]));
  }

  private static hasRequiredFieldValue(value: unknown): boolean {
    if (value === undefined || value === null) {
      return false;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === "string") {
      return value.length > 0;
    }

    if (ZodConfigSchemaBuilder.isPlainRecord(value)) {
      return Object.keys(value).length > 0;
    }

    return true;
  }

  private static isPlainRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }
}
