import { ConfigDefinition } from "../Domain/ConfigDefinition.js";
import type { ConfigSchemaNode } from "../Domain/ConfigSchemaNode.js";
import type { ConfigArrayOptions, ConfigSchemaBuilderBackend } from "../Ports/ConfigSchemaBuilderBackend.js";

export class ConfigSchema {
  private readonly backend: ConfigSchemaBuilderBackend;

  constructor(backend: ConfigSchemaBuilderBackend) {
    this.backend = backend;
  }

  define<TConfig>(params: {
    kind: string;
    schemaId: string;
    title: string;
    description: string;
    filePatterns?: readonly string[];
    rootSchema: ConfigSchemaNode<TConfig>;
  }): ConfigDefinition<TConfig> {
    return new ConfigDefinition(params);
  }

  string(params: { minLength?: number; pattern?: string; patternMessage?: string } = {}): ConfigSchemaNode<string> {
    return this.backend.string(params);
  }

  number(params: { int?: boolean; positive?: boolean; nonnegative?: boolean } = {}): ConfigSchemaNode<number> {
    return this.backend.number(params);
  }

  boolean(): ConfigSchemaNode<boolean> {
    return this.backend.boolean();
  }

  unknown(): ConfigSchemaNode<unknown> {
    return this.backend.unknown();
  }

  literal<TValue extends string | number | boolean | null>(value: TValue): ConfigSchemaNode<TValue> {
    return this.backend.literal(value);
  }

  enum<const TValue extends string>(values: readonly TValue[] | Record<string, TValue>): ConfigSchemaNode<TValue> {
    return this.backend.enum(values);
  }

  array<TValue>(
    element: ConfigSchemaNode<TValue>,
    params: ConfigArrayOptions = {},
  ): ConfigSchemaNode<TValue[]> {
    return this.backend.array(element, params);
  }

  strictObject<TProperties extends ConfigSchemaNode.Record>(
    properties: TProperties,
    params: { requireAtLeastOneField?: readonly string[] } = {},
  ): ConfigSchemaNode<ConfigSchemaNode.RecordValue<TProperties>> {
    return this.backend.strictObject(properties, params);
  }

  record<TValue>(key: ConfigSchemaNode<string>, value: ConfigSchemaNode<TValue>): ConfigSchemaNode<Record<string, TValue>> {
    return this.backend.record(key, value);
  }

  union<TValue>(variants: readonly ConfigSchemaNode<TValue>[]): ConfigSchemaNode<TValue> {
    return this.backend.union(variants);
  }

  discriminatedUnion<TValue>(
    discriminator: string,
    variants: Record<string, ConfigSchemaNode<object>>,
  ): ConfigSchemaNode<TValue> {
    return this.backend.discriminatedUnion<TValue>(discriminator, variants);
  }

  optional<TValue>(node: ConfigSchemaNode<TValue>): ConfigSchemaNode<TValue | undefined> {
    return this.backend.optional(node);
  }

  defaulted<TValue>(node: ConfigSchemaNode<TValue>, defaultValue: Exclude<TValue, undefined>): ConfigSchemaNode<TValue> {
    return this.backend.defaulted(node, defaultValue);
  }
}
