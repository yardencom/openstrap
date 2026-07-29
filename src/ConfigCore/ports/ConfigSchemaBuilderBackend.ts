import type { ConfigSchemaNode } from "../ConfigSchemaNode.js";

export type ConfigEnumValues<TValue extends string> = readonly TValue[] | Record<string, TValue>;

export type ConfigArrayOptions = {
  nonempty?: boolean;
  uniqueBy?: readonly string[];
};

export interface ConfigSchemaBuilderBackend {
  string(params?: { minLength?: number; pattern?: string; patternMessage?: string }): ConfigSchemaNode<string>;
  number(params?: { int?: boolean; positive?: boolean; nonnegative?: boolean }): ConfigSchemaNode<number>;
  boolean(): ConfigSchemaNode<boolean>;
  unknown(): ConfigSchemaNode<unknown>;
  literal<TValue extends string | number | boolean | null>(value: TValue): ConfigSchemaNode<TValue>;
  enum<const TValue extends string>(values: ConfigEnumValues<TValue>): ConfigSchemaNode<TValue>;
  array<TValue>(element: ConfigSchemaNode<TValue>, params?: ConfigArrayOptions): ConfigSchemaNode<TValue[]>;
  strictObject<TProperties extends ConfigSchemaNode.Record>(
    properties: TProperties,
    params?: { requireAtLeastOneField?: readonly string[] },
  ): ConfigSchemaNode<ConfigSchemaNode.RecordValue<TProperties>>;
  record<TValue>(key: ConfigSchemaNode<string>, value: ConfigSchemaNode<TValue>): ConfigSchemaNode<Record<string, TValue>>;
  union<TValue>(variants: readonly ConfigSchemaNode<TValue>[]): ConfigSchemaNode<TValue>;
  discriminatedUnion<TValue>(
    discriminator: string,
    variants: Record<string, ConfigSchemaNode<object>>,
  ): ConfigSchemaNode<TValue>;
  optional<TValue>(node: ConfigSchemaNode<TValue>): ConfigSchemaNode<TValue | undefined>;
  defaulted<TValue>(node: ConfigSchemaNode<TValue>, defaultValue: Exclude<TValue, undefined>): ConfigSchemaNode<TValue>;
}
