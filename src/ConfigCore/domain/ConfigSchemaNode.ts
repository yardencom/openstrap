export class ConfigSchemaNode<TValue = unknown> {
  declare private readonly valueType: TValue;
}

export namespace ConfigSchemaNode {
  export type Record = globalThis.Record<string, ConfigSchemaNode<unknown>>;

  export type Value<TNode extends ConfigSchemaNode<unknown>> =
    TNode extends ConfigSchemaNode<infer TValue> ? TValue : never;

  export type RecordValue<TProperties extends Record> = {
    [TKey in keyof TProperties]: Value<TProperties[TKey]>;
  };
}
