import type { ConfigSchemaNode } from "../../ConfigSchemaNode.js";

export type ZodSchemaValueKind = "primitive" | "object" | "unknown";
export type ZodSchemaLiteralValue = string | number | boolean | null;

type ZodSchemaMetadata = {
  fields?: ReadonlySet<string>;
  fieldLiterals?: ReadonlyMap<string, ZodSchemaLiteralValue>;
  literalValue?: ZodSchemaLiteralValue;
  valueKind?: ZodSchemaValueKind;
};

export class ZodSchemaMetadataRegistry {
  private readonly metadata = new WeakMap<ConfigSchemaNode<unknown>, ZodSchemaMetadata>();

  setFields(node: ConfigSchemaNode<unknown>, fieldNames: readonly string[]): void {
    this.metadata.set(node, {
      ...this.metadata.get(node),
      fields: new Set(fieldNames),
    });
  }

  getFields(node: ConfigSchemaNode<unknown>): ReadonlySet<string> | undefined {
    return this.metadata.get(node)?.fields;
  }

  setFieldLiterals(node: ConfigSchemaNode<unknown>, fieldLiterals: ReadonlyMap<string, ZodSchemaLiteralValue>): void {
    this.metadata.set(node, {
      ...this.metadata.get(node),
      fieldLiterals: new Map(fieldLiterals),
    });
  }

  getFieldLiteralValue(node: ConfigSchemaNode<unknown>, fieldName: string): ZodSchemaLiteralValue | undefined {
    return this.metadata.get(node)?.fieldLiterals?.get(fieldName);
  }

  setLiteralValue(node: ConfigSchemaNode<unknown>, literalValue: ZodSchemaLiteralValue): void {
    this.metadata.set(node, {
      ...this.metadata.get(node),
      literalValue,
    });
  }

  getLiteralValue(node: ConfigSchemaNode<unknown>): ZodSchemaLiteralValue | undefined {
    return this.metadata.get(node)?.literalValue;
  }

  setValueKind(node: ConfigSchemaNode<unknown>, valueKind: ZodSchemaValueKind): void {
    this.metadata.set(node, {
      ...this.metadata.get(node),
      valueKind,
    });
  }

  getValueKind(node: ConfigSchemaNode<unknown>): ZodSchemaValueKind | undefined {
    return this.metadata.get(node)?.valueKind;
  }

  copy(source: ConfigSchemaNode<unknown>, target: ConfigSchemaNode<unknown>): void {
    const metadata = this.metadata.get(source);

    if (metadata) {
      this.metadata.set(target, metadata);
    }
  }
}
